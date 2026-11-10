import { join } from "node:path";
import { ESLint } from "eslint";
import { expect, test } from "vitest";

import { fixture, parser } from "../fixture-test-helpers.mjs";
import createArchitecturePlugin from "./plugin.mjs";

async function lint(source) {
  const root = fixture({
    "lib/setup.ts": "export const ready = true;",
    "lib/consumer.ts": source,
  });
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    ignore: false,
    overrideConfig: [
      {
        files: ["**/*.ts"],
        languageOptions: { parser },
        plugins: { architecture: createArchitecturePlugin(root) },
        rules: { "architecture/side-effect-imports": "error" },
      },
    ],
  });
  const [result] = await eslint.lintFiles([join(root, "lib/consumer.ts")]);
  return result.messages.map(({ ruleId, line }) => ({ ruleId, line }));
}

const REPORTED = [{ ruleId: "architecture/side-effect-imports", line: 1 }];

test("只为副作用引用项目模块会报错，相对路径和 @/ 都一样", async () => {
  expect(await lint('import "./setup";')).toStrictEqual(REPORTED);
  expect(await lint('import "@/lib/setup";')).toStrictEqual(REPORTED);
});

test("空的 import 列表也是只为副作用引用", async () => {
  expect(await lint('import {} from "./setup";')).toStrictEqual(REPORTED);
});

test("按名字引用项目模块不报错", async () => {
  expect(await lint('import { ready } from "./setup";\nready;')).toStrictEqual(
    [],
  );
  expect(await lint('import * as setup from "./setup";\nsetup;')).toStrictEqual(
    [],
  );
});

test("CSS 和 npm 包可以只为副作用引用", async () => {
  expect(await lint('import "./globals.css";')).toStrictEqual([]);
  expect(await lint('import "server-only";')).toStrictEqual([]);
});
