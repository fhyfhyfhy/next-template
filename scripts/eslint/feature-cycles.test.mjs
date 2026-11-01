import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, onTestFinished, test } from "vitest";

import { createFeatureCycleChecker } from "./feature-cycles.mjs";
import { createProjectResolver, SOURCE_EXTENSIONS } from "./imports.mjs";

function fixture(files = {}, config = {}) {
  const root = mkdtempSync(join(tmpdir(), "feature-cycles-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const tsconfig = {
    compilerOptions: {
      module: "esnext",
      moduleResolution: "bundler",
      allowJs: true,
      paths: { "@/*": ["./*"] },
      ...config,
    },
  };
  for (const [file, content] of Object.entries({
    "tsconfig.json": JSON.stringify(tsconfig),
    ...files,
  })) {
    const filename = join(root, file);
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename, content, "utf8");
  }
  return root;
}

function write(root, filename, source) {
  const path = join(root, filename);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source, "utf8");
}

function check(root, filename, checker = createFeatureCycleChecker(root)) {
  const path = join(root, filename);
  return checker(path, readFileSync(path, "utf8"));
}

test("reports nothing without a features directory or when the current file is in no feature", () => {
  const root = fixture();
  const checkFile = createFeatureCycleChecker(root);
  expect(checkFile(join(root, "app/page.ts"), "export {};")).toStrictEqual([]);
});

test("imports within a feature and one-way dependencies across features are allowed", () => {
  const root = fixture({
    "features/a/index.ts": 'export { value } from "./hooks/value";',
    "features/a/hooks/value.ts":
      'import { value as other } from "@/features/b"; export const value = other;',
    "features/b/index.ts": 'export { value } from "./hooks/value";',
    "features/b/hooks/value.ts": "export const value = 1;",
  });
  const checkFile = createFeatureCycleChecker(root);
  expect(check(root, "features/a/index.ts", checkFile)).toStrictEqual([]);
  expect(check(root, "features/a/hooks/value.ts", checkFile)).toStrictEqual([]);
});

test("finds two features depending on each other even when the file graph has no cycle", () => {
  const root = fixture({
    "features/a/index.ts": "export const a = 1;",
    "features/a/components/consumer.ts":
      '\nimport { b } from "@/features/b"; export const value = b;',
    "features/b/index.ts": "export const b = 1;",
    "features/b/components/consumer.ts":
      'import { a } from "@/features/a"; export const value = a;',
  });
  expect(check(root, "features/a/components/consumer.ts")).toStrictEqual([
    {
      specifier: "@/features/b",
      line: 2,
      column: 19,
      endLine: 2,
      endColumn: 33,
      cycle: ["a", "b", "a"],
    },
  ]);
});

test("finds an indirect cycle of three features, and reports only the cycles the current file is in", () => {
  const root = fixture({
    "features/c/index.ts": 'export * from "@/features/a";',
    "features/b/index.ts": 'export * from "@/features/c";',
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/z/index.ts": 'export * from "@/features/y";',
    "features/y/index.ts": 'export * from "@/features/z";',
  });
  const checkFile = createFeatureCycleChecker(root);
  const cycles = check(root, "features/a/index.ts", checkFile);
  expect(cycles.map(({ cycle }) => cycle)).toStrictEqual([
    ["a", "b", "c", "a"],
  ]);
  expect(
    check(root, "features/y/index.ts", checkFile).map(({ cycle }) => cycle),
  ).toStrictEqual([["y", "z", "y"]]);
  expect(check(root, "features/a/index.ts", checkFile)).toStrictEqual(cycles);
});

const references = {
  "type-only import":
    'import type { Item } from "@/features/b"; export type Result = Item;',
  "type-only re-export": 'export type { Item } from "@/features/b";',
  "TypeScript import type": 'export type Item = import("@/features/b").Item;',
  "namespace re-export": 'export * as peer from "@/features/b";',
  "literal dynamic import": 'export const value = import("@/features/b");',
  "static template dynamic import":
    "export const value = import(`@/features/b`);",
  "CommonJS require":
    'const peer = require("@/features/b"); module.exports = peer;',
  "TypeScript import-equals":
    'import peer = require("@/features/b"); export = peer;',
};
for (const [name, source] of Object.entries(references)) {
  test(`${name} is part of the feature graph`, () => {
    const root = fixture({
      "features/a/index.ts": source,
      "features/b/index.ts":
        'export type Item = {}; export * from "@/features/a";',
    });
    expect(
      check(root, "features/a/index.ts").map(({ cycle }) => cycle),
    ).toStrictEqual([["a", "b", "a"]]);
  });
}

for (const extension of SOURCE_EXTENSIONS) {
  test(`scans .${extension} files`, () => {
    const root = fixture({
      [`features/a/index.${extension}`]: `export * from "@/features/b/index.${extension}";`,
      [`features/b/index.${extension}`]: `export * from "@/features/a/index.${extension}";`,
    });
    expect(
      check(root, `features/a/index.${extension}`).map(({ cycle }) => cycle),
    ).toStrictEqual([["a", "b", "a"]]);
  });
}

test("a dependency across features by relative path is still part of the cycle check", () => {
  const root = fixture({
    "features/a/index.ts": 'export * from "../b";',
    "features/b/index.ts": 'export * from "../a";',
  });
  expect(
    check(root, "features/a/index.ts").map(({ cycle }) => cycle),
  ).toStrictEqual([["a", "b", "a"]]);
});

test("type dependencies in declaration files are part of the feature graph", () => {
  const root = fixture({
    "features/a/index.d.ts": 'export type Item = import("@/features/b").Item;',
    "features/b/index.d.ts": 'export type Item = import("@/features/a").Item;',
  });
  expect(
    check(root, "features/a/index.d.ts").map(({ cycle }) => cycle),
  ).toStrictEqual([["a", "b", "a"]]);
});

test("ignores generated directories, third-party modules and dynamic imports that cannot be resolved statically", () => {
  const root = fixture({
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/b/index.ts":
      'import "react"; export const value = import(`@/features/${name}`);',
    "features/b/.next/generated.ts": 'export * from "@/features/a";',
    "features/b/node_modules/package/index.ts": 'export * from "@/features/a";',
  });
  expect(check(root, "features/a/index.ts")).toStrictEqual([]);
});

test("resolves dependencies by tsconfig's actual aliases", () => {
  const root = fixture(
    {
      "features/a/index.ts": 'export * from "@/public/b";',
      "features/b/index.ts": 'export * from "@/public/a";',
    },
    { paths: { "@/public/*": ["./features/*"] } },
  );
  expect(
    check(root, "features/a/index.ts").map(({ cycle }) => cycle),
  ).toStrictEqual([["a", "b", "a"]]);
});

test("the shared resolver reads extends and moduleSuffixes", () => {
  const root = fixture({
    "tsconfig.base.json": JSON.stringify({
      compilerOptions: {
        moduleResolution: "bundler",
        paths: { "@/*": ["./*"] },
        moduleSuffixes: [".native", ""],
      },
    }),
    "tsconfig.json": JSON.stringify({ extends: "./tsconfig.base.json" }),
    "features/a/index.ts": "export const value = 1;",
    "features/a/index.native.ts": "export const value = 2;",
    "app/page.ts": "export {};",
  });
  const imported = createProjectResolver(root)(
    join(root, "app/page.ts"),
    "@/features/a",
  );
  expect(imported.target).toBe(join(root, "features/a/index.native.ts"));
  expect(imported.isAlias).toBe(true);
});

test("the shared resolver normalizes unresolved paths, and third-party packages are left out of the project path checks", () => {
  const root = fixture();
  const resolveImport = createProjectResolver(root);
  expect(
    resolveImport(join(root, "features/a/index.ts"), "../b/../c/missing"),
  ).toStrictEqual({
    target: join(root, "features/c/missing"),
    isRelative: true,
    isAlias: false,
  });
  expect(resolveImport(join(root, "app/page.ts"), "react")).toBe(null);
});

test("the same checker reads changes on disk, and does not reuse old dependencies by timestamp or file size", () => {
  const source = 'export * from "@/features/b";';
  const root = fixture({
    "features/a/index.ts": source,
    "features/b/index.ts": 'export * from "@/features/c";',
    "features/c/index.ts": "export const value = 1;",
  });
  const checkFile = createFeatureCycleChecker(root);
  const target = join(root, "features/b/index.ts");
  const timestamp = new Date("2026-01-01T00:00:00.000Z");
  utimesSync(target, timestamp, timestamp);
  const before = statSync(target);
  expect(check(root, "features/a/index.ts", checkFile)).toStrictEqual([]);
  write(root, "features/b/index.ts", 'export * from "@/features/a";');
  utimesSync(target, timestamp, timestamp);
  const after = statSync(target);
  expect(after.size).toBe(before.size);
  expect(after.mtimeMs).toBe(before.mtimeMs);
  expect(
    checkFile(join(root, "features/a/index.ts"), source).map(
      ({ cycle }) => cycle,
    ),
  ).toStrictEqual([["a", "b", "a"]]);
  write(root, "features/b/index.ts", "export const value = 1;");
  expect(check(root, "features/a/index.ts", checkFile)).toStrictEqual([]);
});

test("the same checker follows dependency files being added, deleted and renamed across directories", () => {
  const root = fixture({
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/b/index.ts": "export const value = 1;",
    "features/c/index.ts": "export const value = 1;",
  });
  const checkFile = createFeatureCycleChecker(root);
  const current = () => check(root, "features/a/index.ts", checkFile);
  expect(current()).toStrictEqual([]);
  write(root, "features/b/consumer.ts", 'export * from "@/features/a";');
  expect(current().length).toBe(1);
  renameSync(
    join(root, "features/b/consumer.ts"),
    join(root, "features/c/consumer.ts"),
  );
  expect(current()).toStrictEqual([]);
  renameSync(
    join(root, "features/c/consumer.ts"),
    join(root, "features/b/renamed.ts"),
  );
  expect(current().length).toBe(1);
  rmSync(join(root, "features/b/renamed.ts"));
  expect(current()).toStrictEqual([]);
});

test("the same checker follows a whole feature directory being added, renamed and deleted", () => {
  const root = fixture({
    "features/a/index.ts": 'export * from "@/features/b";',
  });
  const checkFile = createFeatureCycleChecker(root);
  const current = () => check(root, "features/a/index.ts", checkFile);
  expect(current()).toStrictEqual([]);
  write(root, "features/b/index.ts", 'export * from "@/features/a";');
  expect(current().length).toBe(1);
  renameSync(join(root, "features/b"), join(root, "features/c"));
  expect(current()).toStrictEqual([]);
  renameSync(join(root, "features/c"), join(root, "features/b"));
  expect(current().length).toBe(1);
  rmSync(join(root, "features/b"), { recursive: true });
  expect(current()).toStrictEqual([]);
});

test("the same checker rereads the aliases in tsconfig and its extends", () => {
  const root = fixture({
    "tsconfig.base.json": JSON.stringify({
      compilerOptions: {
        moduleResolution: "bundler",
        paths: { "@/peer": ["./features/c"] },
      },
    }),
    "tsconfig.json": JSON.stringify({ extends: "./tsconfig.base.json" }),
    "features/a/index.ts": 'export * from "@/peer";',
    "features/b/index.ts": 'export * from "../a";',
    "features/c/index.ts": "export const value = 1;",
  });
  const checkFile = createFeatureCycleChecker(root);
  const current = () => check(root, "features/a/index.ts", checkFile);
  expect(current()).toStrictEqual([]);
  write(
    root,
    "tsconfig.base.json",
    JSON.stringify({
      compilerOptions: {
        moduleResolution: "bundler",
        paths: { "@/peer": ["./features/b"] },
      },
    }),
  );
  expect(current().map(({ cycle }) => cycle)).toStrictEqual([["a", "b", "a"]]);
  write(
    root,
    "tsconfig.json",
    JSON.stringify({
      extends: "./tsconfig.base.json",
      compilerOptions: { paths: { "@/peer": ["./features/c"] } },
    }),
  );
  expect(current()).toStrictEqual([]);
});

test("once a config change takes the current file out of the feature graph, other files use the new resolution too", () => {
  const root = fixture(
    {
      "features/a/index.ts": 'export * from "@/peer";',
      "features/b/index.ts": 'export * from "@/features/a";',
      "lib/peer.ts": "export const value = 1;",
    },
    { paths: { "@/*": ["./*"], "@/peer": ["./features/b"] } },
  );
  const checkFile = createFeatureCycleChecker(root);
  expect(check(root, "features/a/index.ts", checkFile).length).toBe(1);
  write(
    root,
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        moduleResolution: "bundler",
        paths: { "@/*": ["./*"], "@/peer": ["./lib/peer"] },
      },
    }),
  );
  expect(check(root, "features/a/index.ts", checkFile)).toStrictEqual([]);
  expect(check(root, "features/b/index.ts", checkFile)).toStrictEqual([]);
});

test("updates dependencies after an atomic file replace even when the size and mtime are the same", () => {
  const root = fixture({
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/b/index.ts": 'export * from "@/features/c";',
    "features/c/index.ts": "export const value = 1;",
  });
  const checkFile = createFeatureCycleChecker(root);
  const target = join(root, "features/b/index.ts");
  const before = statSync(target);
  expect(check(root, "features/a/index.ts", checkFile)).toStrictEqual([]);
  const replacement = join(root, "replacement.ts");
  writeFileSync(replacement, 'export * from "@/features/a";', "utf8");
  utimesSync(replacement, before.atime, before.mtime);
  renameSync(replacement, target);
  expect(statSync(target).size).toBe(before.size);
  expect(check(root, "features/a/index.ts", checkFile).length).toBe(1);
});

test("adding or deleting a preferred resolution target invalidates existing files' dependencies", () => {
  const root = fixture(
    {
      "features/a/index.ts": 'export * from "@/peer";',
      "features/b/index.ts": 'export * from "@/features/a";',
      "features/c/index.ts": "export const value = 1;",
    },
    {
      paths: {
        "@/*": ["./*"],
        "@/peer": ["./features/b/preferred", "./features/c"],
      },
    },
  );
  const checkFile = createFeatureCycleChecker(root);
  const current = () => check(root, "features/a/index.ts", checkFile);
  expect(current()).toStrictEqual([]);
  write(root, "features/b/preferred.ts", "export const value = 1;");
  expect(current().length).toBe(1);
  rmSync(join(root, "features/b/preferred.ts"));
  expect(current()).toStrictEqual([]);
});

test("an invalid config does not fall back to the old resolver, and the same checker recovers once it is fixed", () => {
  const root = fixture({
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/b/index.ts": 'export * from "@/features/a";',
  });
  const checkFile = createFeatureCycleChecker(root);
  const current = () => check(root, "features/a/index.ts", checkFile);
  expect(current().length).toBe(1);
  const config = readFileSync(join(root, "tsconfig.json"), "utf8");
  write(root, "tsconfig.json", "{");
  expect(current).toThrow();
  expect(current).toThrow();
  write(root, "tsconfig.json", config);
  expect(current().length).toBe(1);
});

test("unsaved current text overrides the version on disk, and later calls do not keep the old override", () => {
  const root = fixture({
    "features/a/index.ts": "export const value = 1;",
    "features/b/index.ts": 'export * from "@/features/a";',
  });
  const checkFile = createFeatureCycleChecker(root);
  const filename = join(root, "features/a/index.ts");
  expect(check(root, "features/a/index.ts", checkFile)).toStrictEqual([]);
  expect(
    checkFile(filename, 'export * from "@/features/b";').map(
      ({ cycle }) => cycle,
    ),
  ).toStrictEqual([["a", "b", "a"]]);
  expect(check(root, "features/b/index.ts", checkFile)).toStrictEqual([]);
  expect(check(root, "features/a/index.ts", checkFile)).toStrictEqual([]);
  write(root, "features/a/index.ts", 'export * from "@/features/b";');
  expect(checkFile(filename, "export const value = 1;")).toStrictEqual([]);
  expect(check(root, "features/a/index.ts", checkFile).length).toBe(1);
});

test("a new file not yet on disk is part of the feature graph by the text passed in", () => {
  const root = fixture({
    "features/b/index.ts": 'export * from "@/features/a/new-file";',
  });
  const checkFile = createFeatureCycleChecker(root);
  expect(
    checkFile(
      join(root, "features/a/new-file.ts"),
      'export * from "@/features/b";',
    ).map(({ cycle }) => cycle),
  ).toStrictEqual([["a", "b", "a"]]);
});

test("every current reference along the same feature edge is reported, not only a representative file's", () => {
  const root = fixture({
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/a/consumer.ts":
      'export * from "@/features/b";\nexport type Item = import("@/features/b").Item;',
    "features/b/index.ts": 'export * from "@/features/a";',
  });
  const checkFile = createFeatureCycleChecker(root);
  expect(check(root, "features/a/index.ts", checkFile).length).toBe(1);
  const reports = check(root, "features/a/consumer.ts", checkFile);
  expect(reports.map(({ line }) => line)).toStrictEqual([1, 2]);
  expect(reports.map(({ cycle }) => cycle)).toStrictEqual([
    ["a", "b", "a"],
    ["a", "b", "a"],
  ]);
});

test("a separate cycle among other features does not affect the current one-way reference", () => {
  const root = fixture({
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/b/index.ts": "export const value = 1;",
    "features/c/index.ts": 'export * from "@/features/d";',
    "features/d/index.ts": 'export * from "@/features/c";',
  });
  expect(check(root, "features/a/index.ts")).toStrictEqual([]);
});
