import { expect, test } from "vitest";

import { mergeMigrations } from "./migrate.mjs";

const up = async () => {};

test("各 feature 的 migration 合成一条序列", () => {
  expect(
    Object.keys(
      mergeMigrations([
        { path: "a.mts", migrations: { "20260101_a": { up } } },
        { path: "b.mts", migrations: { "20260102_b": { up } } },
      ]),
    ),
  ).toStrictEqual(["20260101_a", "20260102_b"]);
});

test("两个文件用了同一个 migration 名称时报错，指出后出现的文件", () => {
  expect(() =>
    mergeMigrations([
      { path: "a.mts", migrations: { "20260101_x": { up } } },
      { path: "b.mts", migrations: { "20260101_x": { up } } },
    ]),
  ).toThrow("Duplicate migration name 20260101_x in b.mts");
});
