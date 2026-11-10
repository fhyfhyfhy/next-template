import { join } from "node:path";
import markdown from "@eslint/markdown";
import { ESLint } from "eslint";
import { expect, test } from "vitest";

import { fixture as projectFixture, parser } from "../fixture-test-helpers.mjs";
import createArchitecturePlugin from "./plugin.mjs";

const GRAPH = [
  "# Feature 划分",
  "",
  "```mermaid",
  "flowchart LR",
  "  a[feature-a] -->|用途| b[feature-b]",
  "  c[feature-c]",
  "```",
  "",
].join("\n");

// 带 GRAPH 里三个 feature 的项目。
const fixture = (files) =>
  projectFixture({
    "features/feature-a/index.ts": "export const a = 1;",
    "features/feature-b/index.ts": "export const b = 1;",
    "features/feature-c/index.ts":
      "export const c = 1; export type C = { c: number };",
    ...files,
  });

async function lint(root, file) {
  const architecture = createArchitecturePlugin(root);
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    ignore: false,
    overrideConfig: [
      {
        files: ["**/*.ts"],
        languageOptions: { parser },
        plugins: { architecture },
        rules: { "architecture/feature-dependencies": "error" },
      },
      {
        files: ["docs/features.md"],
        plugins: { markdown, architecture },
        language: "markdown/gfm",
        rules: { "architecture/feature-graph": "error" },
      },
    ],
  });
  const [result] = await eslint.lintFiles([join(root, file)]);
  return result.messages.map(({ messageId, message, line }) => ({
    messageId,
    message,
    line,
  }));
}

test("依赖图里有的边可以导入", async () => {
  const root = fixture({
    "docs/features.md": GRAPH,
    "features/feature-a/main.ts":
      'import { b } from "@/features/feature-b"; export const value = b;',
  });
  expect(await lint(root, "features/feature-a/main.ts")).toStrictEqual([]);
});

test("依赖图和代码一致时，docs/features.md 没有报错", async () => {
  const root = fixture({
    "docs/features.md": GRAPH,
    "features/feature-a/main.ts":
      'import { b } from "@/features/feature-b"; export const value = b;',
  });
  expect(await lint(root, "docs/features.md")).toStrictEqual([]);
});

test("docs/features.md 里代码没用到的边、没有目录的节点、没有节点的目录都报错", async () => {
  const root = fixture({
    "docs/features.md": GRAPH.replace(
      "  c[feature-c]",
      "  c[feature-c]\n  ghost[feature-ghost]",
    ),
    "features/feature-d/index.ts": "export const d = 1;",
  });
  const messages = await lint(root, "docs/features.md");
  expect(
    messages.map(({ messageId, line }) => [messageId, line]),
  ).toStrictEqual([
    ["missingNode", 5],
    ["staleEdge", 5],
    ["missingDirectory", 7],
  ]);
  expect(messages.map(({ message }) => message)).toStrictEqual([
    expect.stringMatching(/features\/feature-d has no node/),
    expect.stringMatching(
      /No file in features\/feature-a depends on feature-b/,
    ),
    expect.stringMatching(/Node feature-ghost has no directory/),
  ]);
});

test("依赖图里没有的边报错，只导入类型也算", async () => {
  const root = fixture({
    "docs/features.md": GRAPH,
    "features/feature-a/main.ts":
      'import type { C } from "@/features/feature-c"; export type Value = C;',
  });
  const messages = await lint(root, "features/feature-a/main.ts");
  expect(messages.map(({ messageId }) => messageId)).toStrictEqual(["missing"]);
  expect(messages[0].message).toMatch(
    /feature-a depends on feature-c, but .* no feature-a --> feature-c edge/,
  );
});

test("边有方向：反过来的依赖要另画一条边", async () => {
  const root = fixture({
    "docs/features.md": GRAPH,
    "features/feature-b/main.ts": 'export { a } from "@/features/feature-a";',
  });
  const messages = await lint(root, "features/feature-b/main.ts");
  expect(messages.map(({ messageId }) => messageId)).toStrictEqual(["missing"]);
});

test("同一 feature 内的导入和 feature 以外的文件不检查", async () => {
  const root = fixture({
    "docs/features.md": GRAPH,
    "features/feature-a/main.ts":
      'import { a } from "./index"; export const value = a;',
    "app/page.ts":
      'import { c } from "@/features/feature-c"; export const value = c;',
  });
  expect(await lint(root, "features/feature-a/main.ts")).toStrictEqual([]);
  expect(await lint(root, "app/page.ts")).toStrictEqual([]);
});

test("依赖图读不出来时，跨 feature 的导入都报错", async () => {
  const root = fixture({
    "features/feature-a/main.ts":
      'import { b } from "@/features/feature-b"; export const value = b;',
  });
  const messages = await lint(root, "features/feature-a/main.ts");
  expect(messages.map(({ messageId }) => messageId)).toStrictEqual(["graph"]);
  expect(messages[0].message).toMatch(/docs\/features\.md does not exist/);
});
