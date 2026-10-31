import fs from "node:fs";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ESLint } from "eslint";
import { expect, onTestFinished, test, vi } from "vitest";

import createFeatureCycleRule from "./no-feature-cycle.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "no-feature-cycle-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, source] of Object.entries({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "esnext",
        moduleResolution: "bundler",
        paths: { "@/*": ["./*"] },
      },
    }),
    ...files,
  })) {
    const filename = join(root, file);
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename, source, "utf8");
  }
  return root;
}

function eslintFor(root) {
  return new ESLint({
    cwd: root,
    overrideConfigFile: true,
    ignore: false,
    overrideConfig: [
      {
        files: ["**/*.{js,ts}"],
        plugins: {
          architecture: {
            rules: { "no-feature-cycle": createFeatureCycleRule(root) },
          },
        },
        rules: { "architecture/no-feature-cycle": "error" },
      },
    ],
  });
}

test("仅 lint 一个文件也报告其 feature 循环，并定位到完整引用字符串", async () => {
  const root = fixture({
    "features/a/index.ts": "export const a = 1;",
    "features/a/consumer.ts": '\nexport * from "@/features/b";\n',
    "features/b/index.ts": "export const b = 1;",
    "features/b/consumer.ts": 'export * from "@/features/a";',
  });
  const filename = join(root, "features/a/consumer.ts");
  const results = await eslintFor(root).lintFiles([filename]);
  expect(results.length).toBe(1);
  expect(results[0].filePath).toBe(filename);
  expect(results[0].errorCount).toBe(1);
  const [message] = results[0].messages;
  expect(message.ruleId).toBe("architecture/no-feature-cycle");
  expect(message.message).toMatch(/a -> b -> a/);
  expect({
    line: message.line,
    column: message.column,
    endLine: message.endLine,
    endColumn: message.endColumn,
  }).toStrictEqual({ line: 2, column: 15, endLine: 2, endColumn: 29 });
});

test("同一 ESLint 实例的 lintText 使用未保存文本并支持尚未落盘的文件", async () => {
  const root = fixture({
    "features/a/index.ts": "export const a = 1;",
    "features/b/index.ts": 'export * from "@/features/a";',
  });
  const eslint = eslintFor(root);
  const filePath = join(root, "features/a/unsaved.ts");
  const [before] = await eslint.lintText("export const value = 1;", {
    filePath,
  });
  expect(before.errorCount).toBe(0);

  const [edited] = await eslint.lintText(
    '\nexport * from "@/features/b";\nexport * from "@/features/b";',
    { filePath },
  );
  expect(edited.errorCount).toBe(2);
  expect(
    edited.messages.map(({ ruleId, line }) => ({ ruleId, line })),
  ).toStrictEqual([
    { ruleId: "architecture/no-feature-cycle", line: 2 },
    { ruleId: "architecture/no-feature-cycle", line: 3 },
  ]);
  const [after] = await eslint.lintText("export const value = 1;", {
    filePath,
  });
  expect(after.errorCount).toBe(0);
  expect(existsSync(filePath)).toBe(false);
});

test("未保存文本删除跨 feature 引用后，不沿用磁盘中的循环", async () => {
  const root = fixture({
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/b/index.ts": 'export * from "@/features/a";',
  });
  const eslint = eslintFor(root);
  const filePath = join(root, "features/a/index.ts");
  const [saved] = await eslint.lintFiles([filePath]);
  expect(saved.errorCount).toBe(1);
  const [unsaved] = await eslint.lintText("export const value = 1;", {
    filePath,
  });
  expect(unsaved.errorCount).toBe(0);
});

test("全项目 lint 在文件未变化时复用读取结果，不逐文件重读整个项目", async () => {
  const files = {};
  for (let index = 0; index < 40; index++) {
    const feature = Math.floor(index / 4);
    const name = index % 4 === 0 ? "index" : `file-${index}`;
    files[`features/f${feature}/${name}.ts`] =
      feature === 9
        ? "export const value = 1;"
        : 'export { value } from "@/features/f9";';
  }
  const root = fixture(files);
  const originalRead = fs.readFileSync;
  const originalReadDirectory = fs.readdirSync;
  let reads = 0;
  let directoryReads = 0;
  const readMock = vi
    .spyOn(fs, "readFileSync")
    .mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].startsWith(root)) reads++;
      return originalRead(...args);
    });
  const directoryMock = vi
    .spyOn(fs, "readdirSync")
    .mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].startsWith(root))
        directoryReads++;
      return originalReadDirectory(...args);
    });
  syncBuiltinESMExports();
  onTestFinished(() => {
    readMock.mockRestore();
    directoryMock.mockRestore();
    syncBuiltinESMExports();
  });

  const results = await eslintFor(root).lintFiles(["features/**/*.ts"]);
  expect(results.length).toBe(Object.keys(files).length);
  expect(
    results
      .filter((result) => result.errorCount > 0)
      .map((result) => result.filePath),
  ).toStrictEqual([]);
  expect(
    reads,
    `未变化的 ${Object.keys(files).length} 个文件不应触发这么多次同步读取`,
  ).toBeLessThanOrEqual(Object.keys(files).length * 2);
  expect(
    directoryReads,
    "目录未变化时不应触发这么多次同步枚举",
  ).toBeLessThanOrEqual(Object.keys(files).length * 2);
});
