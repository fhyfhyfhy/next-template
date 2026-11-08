import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, test } from "vitest";

// agent 读的文档靠相对链接互相引用；移动或改名文件时，这里会指出失效的链接。指向本仓库 GitHub 的链接另外检查
// （见 SAMPLE_PRODUCT），其他外部链接和 node_modules 里的安装文档不检查。

const projectRoot = join(import.meta.dirname, "..");
const read = (file) =>
  readFileSync(join(projectRoot, file), "utf8").replace(/\r\n/g, "\n");

// 第三方 skill 是上游原文，只随升级变化，不在检查范围内（skills-lock.json）。
const thirdPartySkills = new Set(
  Object.keys(JSON.parse(read("skills-lock.json")).skills),
);
const docs = [
  "AGENTS.md",
  "README.md",
  "GLOSSARY.md",
  ...globSync("docs/**/*.md", { cwd: projectRoot }),
  ...globSync(".claude/rules/**/*.md", { cwd: projectRoot }),
  ...globSync(".agents/skills/*/**/*.md", { cwd: projectRoot }).filter(
    (file) => !thirdPartySkills.has(file.split(/[\\/]/)[2]),
  ),
].map((file) => file.split("\\").join("/"));

/** 去掉代码块和行内代码：里面的方括号、井号不是链接和标题。 */
function prose(text) {
  return text.replace(/^(```|````)[\s\S]*?^\1/gm, "").replace(/`[^`\n]*`/g, "");
}

/** GitHub 给标题生成的锚点：小写，去掉标点，空格换成连字符，重名的依次加 -1、-2。 */
function anchors(file) {
  const seen = new Map();
  const result = new Set();
  const text = read(file).replace(/^(```|````)[\s\S]*?^\1/gm, "");
  for (const [, heading] of text.matchAll(/^#{1,6} +(.+?) *#*$/gm)) {
    const base = heading
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/`/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    result.add(count === 0 ? base : `${base}-${count}`);
  }
  return result;
}

function brokenLinks(file, text = read(file)) {
  const broken = [];
  for (const [, target] of prose(text).matchAll(
    /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
  )) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const [path, anchor] = target.split("#");
    const resolved = path
      ? relative(projectRoot, join(projectRoot, dirname(file), path))
      : file;
    if (resolved.startsWith("node_modules")) continue;
    if (!existsSync(join(projectRoot, resolved))) {
      broken.push(target);
    } else if (
      anchor &&
      statSync(join(projectRoot, resolved)).isFile() &&
      !anchors(resolved).has(anchor)
    ) {
      broken.push(target);
    }
  }
  return broken;
}

describe("文档里的相对链接和锚点都能打开", () => {
  test.each(docs)("%s", (file) => {
    expect(brokenLinks(file)).toStrictEqual([]);
  });
});

test("检查本身能发现失效的链接和锚点", () => {
  expect(
    brokenLinks(
      ".claude/rules/example.md",
      "[a](e2e.md#hydration) [b](missing.md) [c](e2e.md#no-such-heading) `[d](missing.md)`",
    ),
  ).toStrictEqual(["missing.md", "e2e.md#no-such-heading"]);
});

// Sample product 的代码，派生项目会删掉它（.agents/skills/derived-project/SKILL.md 的 Sample product）。agent 读的文档
// 引用它时链接到模板在 GitHub 上的版本，链接文字是从仓库根开始的路径（.agents/skills/skills-and-rules/SKILL.md 的
// Citing code）。派生项目删掉 Sample product 时清空 SAMPLE_PRODUCT：链接指向模板的仓库，本地已经没有对应的文件。
// 列表和 derived-project 列出的代码一致：目录、spec 和种子数据；`app/api/` 只列 Sample product 自己的目录，因为 rules
// 用 `app/api/` 泛指 Route Handler 的位置。固定到某个提交的链接照样检查。
const GITHUB_LINK =
  /^https:\/\/github\.com\/fhyfhyfhy\/next-template\/(?:blob|tree)\/[^/]+\/([^#?]+)/;
const SAMPLE_PRODUCT = [
  "features/task/",
  "features/upload/",
  "app/[locale]/(tasks)/",
  "app/api/tasks/",
  "app/api/feed/",
  "e2e/tasks.ts",
  "e2e/tasks.spec.ts",
  "e2e/task-detail.spec.ts",
  "e2e/feed.spec.ts",
  "e2e/search.spec.ts",
  "e2e/recent.spec.ts",
  "scripts/local-services/seed",
];
const agentDocs = docs.filter(
  (file) =>
    file === "AGENTS.md" ||
    [".claude/rules/", ".agents/skills/", "docs/agents/"].some((dir) =>
      file.startsWith(dir),
    ),
);
// 链接文字里可以有一层方括号，比如 [`app/[locale]/page.tsx`](…)；URL 里的括号已经转义。
const MARKDOWN_LINK = /\[((?:[^[\]]|\[[^[\]]*\])*)\]\(([^)\s]+)\)/g;
const withoutCodeBlocks = (text) =>
  text.replace(/^(```|````)[\s\S]*?^\1/gm, "");

/** 指向本仓库 GitHub 的链接：路径要在仓库里存在，链接文字写成代码时要和路径一致。 */
function brokenGithubLinks(file, text = read(file)) {
  const broken = [];
  for (const [, label, target] of withoutCodeBlocks(text).matchAll(
    MARKDOWN_LINK,
  )) {
    const match = GITHUB_LINK.exec(target);
    if (!match) continue;
    const path = decodeURIComponent(match[1]);
    const code = /^`([^`]+)`$/.exec(label)?.[1];
    if (
      (SAMPLE_PRODUCT.length > 0 && !existsSync(join(projectRoot, path))) ||
      (code && code.replace(/\/$/, "") !== path)
    ) {
      broken.push(target);
    }
  }
  return broken;
}

/** 链接之外出现的 Sample product 路径。 */
function unlinkedSamplePaths(file, text = read(file)) {
  const rest = withoutCodeBlocks(text).replace(MARKDOWN_LINK, "");
  return SAMPLE_PRODUCT.filter((path) => rest.includes(path));
}

describe("指向本仓库 GitHub 的链接：路径在仓库里存在，链接文字和路径一致", () => {
  test.each(docs)("%s", (file) => {
    expect(brokenGithubLinks(file)).toStrictEqual([]);
  });
});

describe("agent 读的文档引用 Sample product 时都带 GitHub 链接", () => {
  test.each(agentDocs)("%s", (file) => {
    expect(unlinkedSamplePaths(file)).toStrictEqual([]);
  });
});

test("检查本身能发现失效的 GitHub 链接和没带链接的 Sample product 路径", () => {
  const base = "https://github.com/fhyfhyfhy/next-template";
  const sha = "0123456789abcdef0123456789abcdef01234567";
  expect(
    brokenGithubLinks(
      ".claude/rules/example.md",
      [
        `[\`lib/fetch.ts\`](${base}/blob/main/lib/fetch.ts)`,
        `[\`app/[locale]/(tasks)/layout.tsx\`](${base}/blob/main/app/%5Blocale%5D/%28tasks%29/layout.tsx)`,
        `[\`features/task/\`](${base}/tree/main/features/task)`,
        `[\`lib/missing.ts\`](${base}/blob/main/lib/missing.ts)`,
        `[\`lib/db.ts\`](${base}/blob/main/lib/fetch.ts)`,
        // 固定到某个提交的链接照样检查。
        `[\`lib/fetch.ts\`](${base}/blob/${sha}/lib/fetch.ts)`,
        `[\`lib/missing.ts\`](${base}/blob/${sha}/lib/missing.ts)`,
        `[\`features/task/\`](${base}/tree/${sha}/features/upload)`,
      ].join(" "),
    ),
  ).toStrictEqual([
    `${base}/blob/main/lib/missing.ts`,
    `${base}/blob/main/lib/fetch.ts`,
    `${base}/blob/${sha}/lib/missing.ts`,
    `${base}/tree/${sha}/features/upload`,
  ]);
  expect(
    unlinkedSamplePaths(
      ".claude/rules/example.md",
      `\`features/task/server/tasks.ts\` and [\`features/upload/server.ts\`](${base}/blob/main/features/upload/server.ts)`,
    ),
  ).toStrictEqual(["features/task/"]);
});

// README 是给人看的项目介绍，随时会改：agent 读的文档不引用它，agent 要用的内容写在 agent 文档里。derived-project
// skill 把 README.md 列为派生项目要改写成自己的文件，提到它不算引用。
/** agent 读的文档里提到 README.md 的地方。 */
function readmeReferences(file, text = read(file)) {
  if (file.startsWith(".agents/skills/derived-project/")) return [];
  return text.match(/README\.md[^\s)`"]*/g) ?? [];
}

describe("agent 读的文档不引用 README", () => {
  test.each(agentDocs)("%s", (file) => {
    expect(readmeReferences(file)).toStrictEqual([]);
  });
});

test("检查本身能发现对 README 的引用", () => {
  expect(
    readmeReferences(
      ".claude/rules/example.md",
      'read [Tests](../../README.md#tests) and "Checks" in `README.md`',
    ),
  ).toStrictEqual(["README.md#tests", "README.md"]);
});
