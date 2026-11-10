import { join } from "node:path";
import { ESLint } from "eslint";
import { expect, test } from "vitest";

import { fixture, parser } from "../fixture-test-helpers.mjs";
import createArchitecturePlugin from "./plugin.mjs";

// 规则本身的识别范围；哪些文件受检查由 eslint.config.mjs 决定，在 eslint.config.test.mjs 里验证。
async function lint(source, file = "features/shop/api/probe.ts") {
  const root = fixture({
    "lib/db.ts": "export const getDb = () => null;",
    "lib/store/pool.ts": "export const pool = null;",
    "lib/store/index.ts": 'export { pool } from "./pool";',
    "lib/database.ts": "export const other = null;",
    "lib/db.test.ts": "export const unrelated = null;",
    [file]: source,
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
        rules: {
          "architecture/data-access": [
            "error",
            { modules: ["lib/db", "lib/store"], packages: ["pg", "kysely"] },
          ],
        },
      },
    ],
  });
  const [result] = await eslint.lintFiles([join(root, file)]);
  return result.messages.map(({ ruleId, message }) =>
    ruleId === "architecture/data-access"
      ? message.match(/import (\S+)[.:]/)[1]
      : message,
  );
}

test.each([
  ["别名", 'import { getDb } from "@/lib/db"; getDb();'],
  ["相对路径", 'import { getDb } from "../../../lib/db"; getDb();'],
  ["带扩展名", 'import { getDb } from "@/lib/db.ts"; getDb();'],
  ["re-export", 'export { getDb } from "@/lib/db";'],
  ["export *", 'export * from "@/lib/db";'],
  ["动态 import", 'export const probe = () => import("@/lib/db");'],
  ["模板字符串", "export const probe = () => import(`@/lib/db`);"],
  [
    "import type",
    'import type { getDb } from "@/lib/db"; export type P = typeof getDb;',
  ],
  ["import() 类型", 'export type P = typeof import("@/lib/db").getDb;'],
  ["require", 'export const probe = require("@/lib/db");'],
  ["import = require", 'import db = require("@/lib/db"); export { db };'],
])("连接模块用%s引用都报错", async (_how, source) => {
  expect(await lint(source)).toStrictEqual(["lib/db"]);
});

test("模块是目录时，它的入口和里面的文件都算", async () => {
  expect(await lint('import { pool } from "@/lib/store"; pool;')).toStrictEqual(
    ["lib/store"],
  );
  expect(
    await lint('import { pool } from "@/lib/store/pool"; pool;'),
  ).toStrictEqual(["lib/store"]);
});

test("数据库客户端的包连同子路径、只引用类型都报错", async () => {
  expect(await lint('import pg from "pg"; pg;')).toStrictEqual(["pg"]);
  expect(
    await lint(
      'import type { Kysely } from "kysely"; export type P = Kysely<object>;',
    ),
  ).toStrictEqual(["kysely"]);
  expect(
    await lint(
      'import type { Migration } from "kysely/migration"; export type P = Migration;',
    ),
  ).toStrictEqual(["kysely"]);
});

test("名字相近的模块和包不报错", async () => {
  expect(
    await lint(
      [
        'import { other } from "@/lib/database";',
        'import { unrelated } from "@/lib/db.test";',
        'import pgTools from "pg-tools";',
        'import { z } from "zod";',
        "export const probe = [other, unrelated, pgTools, z];",
      ].join("\n"),
    ),
  ).toStrictEqual([]);
});
