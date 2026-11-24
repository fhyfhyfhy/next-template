import { join } from "node:path";
import { ESLint } from "eslint";
import { expect, test } from "vitest";

import { fixture as projectFixture, parser } from "../fixture-test-helpers.mjs";
import createArchitecturePlugin from "./plugin.mjs";

const SOURCE = "export const value = 1;";
const EXAMPLES = "features/ui-catalog/components";

// button、dialog 有示例，orphan、lonely 没有，ghost 只有示例；example-list 不是示例目录。
const fixture = () =>
  projectFixture({
    "components/ui/button.tsx": SOURCE,
    "components/ui/button.test.tsx": SOURCE,
    "components/ui/dialog/index.ts": SOURCE,
    "components/ui/dialog/popup.tsx": SOURCE,
    "components/ui/orphan.tsx": SOURCE,
    "components/ui/orphan.test.tsx": SOURCE,
    "components/ui/lonely/index.tsx": SOURCE,
    "components/ui/lonely/root.tsx": SOURCE,
    "components/ui/ghost.test.tsx": SOURCE,
    [`${EXAMPLES}/button-examples/index.ts`]: SOURCE,
    [`${EXAMPLES}/dialog-examples/index.ts`]: SOURCE,
    [`${EXAMPLES}/ghost-examples/index.ts`]: SOURCE,
    [`${EXAMPLES}/ghost-examples/preview.tsx`]: SOURCE,
    [`${EXAMPLES}/example-list/index.ts`]: SOURCE,
  });

/** 每个文件的报告消息；没有报告的文件不列出。 */
async function reported(root, files) {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    ignore: false,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx}"],
        languageOptions: { parser },
        plugins: { architecture: createArchitecturePlugin(root) },
        rules: { "architecture/catalog-examples": "error" },
      },
    ],
  });
  const results = await eslint.lintFiles(files.map((file) => join(root, file)));
  return Object.fromEntries(
    results
      .filter(({ messages }) => messages.length)
      .map(({ filePath, messages }) => [
        filePath
          .slice(root.length + 1)
          .split("\\")
          .join("/"),
        messages.map(({ message }) => message),
      ]),
  );
}

test("有示例目录的组件、有组件的示例目录都不报", async () => {
  const root = fixture();
  expect(
    await reported(root, [
      "components/ui/button.tsx",
      "components/ui/dialog/index.ts",
      `${EXAMPLES}/button-examples/index.ts`,
      `${EXAMPLES}/dialog-examples/index.ts`,
    ]),
  ).toStrictEqual({});
});

test("缺示例目录的组件报在单文件组件或组件目录的 index 入口上", async () => {
  const root = fixture();
  const missing = (id) =>
    `components/ui/${id} has no UI catalog examples. Add features/ui-catalog/components/${id}-examples/ in the same change, as .claude/rules/ui-catalog.md describes.`;
  expect(
    await reported(root, [
      "components/ui/orphan.tsx",
      "components/ui/orphan.test.tsx",
      "components/ui/lonely/index.tsx",
      "components/ui/lonely/root.tsx",
    ]),
  ).toStrictEqual({
    "components/ui/orphan.tsx": [missing("orphan")],
    "components/ui/lonely/index.tsx": [missing("lonely")],
  });
});

test("没有组件的示例目录报在它的 index.ts 上，同名的测试文件不算组件", async () => {
  const root = fixture();
  expect(
    await reported(root, [
      `${EXAMPLES}/ghost-examples/index.ts`,
      `${EXAMPLES}/ghost-examples/preview.tsx`,
      `${EXAMPLES}/example-list/index.ts`,
      "components/ui/ghost.test.tsx",
      "components/ui/dialog/popup.tsx",
    ]),
  ).toStrictEqual({
    [`${EXAMPLES}/ghost-examples/index.ts`]: [
      "features/ui-catalog/components/ghost-examples/ has no component to show: components/ui/ has no ghost. Name the directory after the component's ID, or remove it along with the component.",
    ],
  });
});
