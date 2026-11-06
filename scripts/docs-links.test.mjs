import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, test } from "vitest";

// agent 读的文档靠相对链接互相引用；移动或改名文件时，这里会指出失效的链接。外部链接和 node_modules 里的安装文档不检查。

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

// 示例业务的代码，派生项目会删掉它（README 的 Starting a project）。agent 读的文档引用它时链接到模板在 GitHub
// 上的版本，链接文字是从仓库根开始的路径（.agents/skills/skills-and-rules/SKILL.md 的 Citing code）。
// 派生项目删掉示例业务时清空 SAMPLE_PRODUCT：链接指向模板的仓库，本地已经没有对应的文件。
const GITHUB_LINK =
  /^https:\/\/github\.com\/fhyfhyfhy\/next-template\/(?:blob|tree)\/main\/([^#?]+)/;
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

/** 链接之外出现的示例业务路径。 */
function unlinkedSamplePaths(file, text = read(file)) {
  const rest = withoutCodeBlocks(text).replace(MARKDOWN_LINK, "");
  return SAMPLE_PRODUCT.filter((path) => rest.includes(path));
}

describe("指向本仓库 GitHub 的链接都能打开", () => {
  test.each(docs)("%s", (file) => {
    expect(brokenGithubLinks(file)).toStrictEqual([]);
  });
});

describe("agent 读的文档引用示例业务时都带 GitHub 链接", () => {
  test.each(agentDocs)("%s", (file) => {
    expect(unlinkedSamplePaths(file)).toStrictEqual([]);
  });
});

test("检查本身能发现失效的 GitHub 链接和没带链接的示例业务路径", () => {
  const base = "https://github.com/fhyfhyfhy/next-template";
  expect(
    brokenGithubLinks(
      ".claude/rules/example.md",
      [
        `[\`lib/fetch.ts\`](${base}/blob/main/lib/fetch.ts)`,
        `[\`app/[locale]/(tasks)/layout.tsx\`](${base}/blob/main/app/%5Blocale%5D/%28tasks%29/layout.tsx)`,
        `[\`features/task/\`](${base}/tree/main/features/task)`,
        `[\`lib/missing.ts\`](${base}/blob/main/lib/missing.ts)`,
        `[\`lib/db.ts\`](${base}/blob/main/lib/fetch.ts)`,
      ].join(" "),
    ),
  ).toStrictEqual([
    `${base}/blob/main/lib/missing.ts`,
    `${base}/blob/main/lib/fetch.ts`,
  ]);
  expect(
    unlinkedSamplePaths(
      ".claude/rules/example.md",
      `\`features/task/server/tasks.ts\` and [\`features/upload/server.ts\`](${base}/blob/main/features/upload/server.ts)`,
    ),
  ).toStrictEqual(["features/task/"]);
});
