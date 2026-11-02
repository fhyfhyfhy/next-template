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

test("linting a single file reports its feature cycle too, located at the whole import string", async () => {
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

test("lintText on the same ESLint instance uses unsaved text and supports files not yet on disk", async () => {
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

test("once unsaved text removes the cross-feature reference, the cycle on disk is not reused", async () => {
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

test("a whole-project lint reuses what it read while files are unchanged, rather than rereading the project for each file", async () => {
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
    `${Object.keys(files).length} unchanged files should not cause this many synchronous reads`,
  ).toBeLessThanOrEqual(Object.keys(files).length * 2);
  expect(
    directoryReads,
    "unchanged directories should not cause this many synchronous listings",
  ).toBeLessThanOrEqual(Object.keys(files).length * 2);
});
