import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, test } from "vitest";

// agent 读的文档靠相对链接互相引用，demos.md 还按场景列出代码和 spec 的路径；移动或改名文件时，
// 这里会指出失效的引用。外部链接和 node_modules 里的安装文档不检查。

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

function missingDemoPaths(text) {
  const missing = [];
  for (const row of text.matchAll(/^\| \d+ \|.*$/gm)) {
    // 列依次是 #、Scenario、Rules、Code、Spec。
    const [, , , code, spec] = row[0].split(" | ");
    for (const [, path] of `${code} ${spec}`.matchAll(/`([^`]+)`/g)) {
      if (!path.includes("/")) continue;
      const full = /^(app|e2e)\//.test(path)
        ? path
        : `features/demo-task/${path}`;
      const found = path.includes("*")
        ? globSync(full, { cwd: projectRoot }).length > 0
        : existsSync(join(projectRoot, full));
      if (!found) missing.push(path);
    }
  }
  return missing;
}

test("demos.md 场景表列出的代码和 spec 都存在", () => {
  expect(
    missingDemoPaths(read(".agents/skills/next-data-flow/demos.md")),
  ).toStrictEqual([]);
});

test("检查本身能发现失效的链接、锚点和路径", () => {
  expect(
    brokenLinks(
      ".claude/rules/example.md",
      "[a](e2e.md#hydration) [b](missing.md) [c](e2e.md#no-such-heading) `[d](missing.md)`",
    ),
  ).toStrictEqual(["missing.md", "e2e.md#no-such-heading"]);
  expect(
    missingDemoPaths(
      "| 1 | x | y | `api/get-task.ts`, `api/missing.ts`, `api/*-nothing.ts` | `e2e/demo/feed.spec.ts` |",
    ),
  ).toStrictEqual(["api/missing.ts", "api/*-nothing.ts"]);
});
