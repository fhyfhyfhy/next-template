import { join } from "node:path";
import markdown from "@eslint/markdown";
import { ESLint } from "eslint";
import { expect, test } from "vitest";

import createDocsPlugin from "./docs-plugin.mjs";
import { fixture } from "./fixture-test-helpers.mjs";

const base = "https://github.com/fhyfhyfhy/next-template";
const sha = "0123456789abcdef0123456789abcdef01234567";
const links = [
  `[\`lib/request/fetch.ts\`](${base}/blob/main/lib/request/fetch.ts)`,
  `[\`lib/missing.ts\`](${base}/blob/main/lib/missing.ts)`,
  `[\`lib/missing.ts\`](${base}/blob/${sha}/lib/missing.ts)`,
  `[\`features/task/\`](${base}/tree/${sha}/features/upload)`,
].join("\n\n");

/** 在 `files` 组成的项目里，template-links 对 `links` 报告的行。 */
async function reportedLines(files) {
  const root = fixture({ "lib/request/fetch.ts": "", ...files });
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.md"],
        plugins: { markdown, docs: createDocsPlugin(root) },
        language: "markdown/gfm",
        rules: { "docs/template-links": "error" },
      },
    ],
  });
  const [result] = await eslint.lintText(links, {
    filePath: join(root, "AGENTS.md"),
  });
  return result.messages.map(({ line, messageId }) => [line, messageId]);
}

// 规则按 Sample product 的路径有没有一个存在，区分有它的 template 和删掉了它的派生项目。
test("Sample product 在时，GitHub 链接的文件要在本地存在，固定到某个提交的也一样", async () => {
  expect(await reportedLines({ "features/task/index.ts": "" })).toStrictEqual([
    [3, "missing"],
    [5, "missing"],
    [7, "missing"],
    [7, "label"],
  ]);
});

test("派生项目删掉了 Sample product，只检查链接文字", async () => {
  expect(await reportedLines({})).toStrictEqual([[7, "label"]]);
});
