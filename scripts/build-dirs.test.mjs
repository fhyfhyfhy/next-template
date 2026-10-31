import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";

import { BUILD_DIRS, buildDir, withoutBuildDirVars } from "./build-dirs.mjs";

const projectRoot = join(import.meta.dirname, "..");
const lines = (file) =>
  readFileSync(join(projectRoot, file), "utf8")
    .replace(/\r\n/g, "\n")
    .split("\n");

test("四种 build 各用自己的目录", () => {
  expect(BUILD_DIRS).toStrictEqual([
    ".next",
    ".next-e2e",
    ".next-demo",
    ".next-demo-e2e",
  ]);
  expect(buildDir({ NEXT_PUBLIC_MOCK_API: "1", EXPOSE_TESTING_API: "1" })).toBe(
    ".next-demo-e2e",
  );
});

test("每个 build 目录都在 .gitignore 和 .prettierignore 里", () => {
  for (const dir of BUILD_DIRS) {
    expect(lines(".gitignore")).toContain(`/${dir}/`);
    expect(lines(".prettierignore")).toContain(`${dir}/`);
  }
});

test("tsconfig.json 排除 .next 以外的 build 目录，只读 .next/types", () => {
  const { config } = ts.readConfigFile(
    join(projectRoot, "tsconfig.json"),
    ts.sys.readFile,
  );
  expect(config.exclude).toStrictEqual(
    expect.arrayContaining([
      ".next/dev",
      ...BUILD_DIRS.filter((dir) => dir !== ".next"),
    ]),
  );
});

test("去掉决定目录的变量后，typegen 写的是 .next", () => {
  const env = withoutBuildDirVars({
    EXPOSE_TESTING_API: "1",
    NEXT_PUBLIC_MOCK_API: "1",
    PATH: "/usr/bin",
  });
  expect(buildDir(env)).toBe(".next");
  expect(env.PATH).toBe("/usr/bin");
});
