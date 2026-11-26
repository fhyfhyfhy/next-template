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

/** 在 `files` 组成的项目里，docs 插件的 `rule` 对 AGENTS.md 里 `text` 的报告。 */
async function lint(files, rule, text) {
  const root = fixture(files);
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.md"],
        plugins: { markdown, docs: createDocsPlugin(root) },
        language: "markdown/gfm",
        rules: { [`docs/${rule}`]: "error" },
      },
    ],
  });
  const [result] = await eslint.lintText(text, {
    filePath: join(root, "AGENTS.md"),
  });
  return result.messages;
}

/** 在 `files` 组成的项目里，template-links 对 `links` 报告的行。 */
async function reportedLines(files) {
  const messages = await lint(
    { "lib/request/fetch.ts": "", ...files },
    "template-links",
    links,
  );
  return messages.map(({ line, messageId }) => [line, messageId]);
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

/** 链接 `anchors` 都指向 target.md 里的标题，relative-links 报告的是哪几个。 */
async function missingAnchors(target, anchors) {
  const links = anchors.map((anchor) => `[${anchor}](target.md#${anchor})`);
  const messages = await lint(
    { "target.md": target },
    "relative-links",
    links.join("\n\n"),
  );
  return messages.map(({ line }) => anchors[(line - 1) / 2]);
}

test("链接目标里的代码块可以用波浪线、缩进 3 格以内，块里的井号不是标题", async () => {
  const target = [
    "```md",
    "# In backticks",
    "````",
    "",
    "~~~md",
    "# In tildes",
    "~~~~",
    "",
    "  ```md",
    "# In indented",
    "   ```",
    "",
    "# After",
    "",
  ].join("\n");
  expect(
    await missingAnchors(target, [
      "in-backticks",
      "in-tildes",
      "in-indented",
      "after",
    ]),
  ).toStrictEqual(["in-backticks", "in-tildes", "in-indented"]);
});

test("链接目标里的代码块按 CommonMark 闭合：更长的闭合行能闭合，更短的、后面带文字的、换了字符的、缩进 4 格的不能", async () => {
  for (const [fence, other] of [
    ["```", "~~~"],
    ["~~~", "```"],
  ]) {
    const longer = fence + fence[0];
    const target = [
      `${fence}md`,
      "# In block",
      longer,
      "",
      "# Between",
      "",
      `${longer}md`,
      "# After shorter",
      fence,
      "# After text",
      `${longer} md`,
      "# After other",
      other + other[0],
      "# After deep indent",
      `    ${longer}`,
      "# Still inside",
      longer,
      "",
    ].join("\n");
    expect(
      await missingAnchors(target, [
        "between",
        "after-shorter",
        "after-text",
        "after-other",
        "after-deep-indent",
        "still-inside",
      ]),
      fence,
    ).toStrictEqual([
      "after-shorter",
      "after-text",
      "after-other",
      "after-deep-indent",
      "still-inside",
    ]);
  }
});

test("缩进 4 格的和 info string 带反引号的不是 fence，顶格没闭合的 fence 一直到文件末尾", async () => {
  for (const fence of ["```", "~~~"]) {
    const target = [
      "    ```md",
      "# Not fenced",
      "",
      "```js` x",
      "# Not fenced either",
      "",
      `${fence}md`,
      "# Unclosed",
      "",
    ].join("\n");
    expect(
      await missingAnchors(target, [
        "not-fenced",
        "not-fenced-either",
        "unclosed",
      ]),
      fence,
    ).toStrictEqual(["unclosed"]);
  }
});

test("列表项里没闭合的 fence 随列表项结束，后面的标题照样算", async () => {
  const target = [
    "- item",
    "  ```md",
    "  code",
    "- next",
    "",
    "# After",
    "",
  ].join("\n");
  expect(await missingAnchors(target, ["after"])).toStrictEqual([]);
});
