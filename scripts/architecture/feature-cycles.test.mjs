import assert from "node:assert/strict";
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
import test from "node:test";

import { createFeatureCycleChecker } from "./feature-cycles.mjs";
import { createProjectResolver, SOURCE_EXTENSIONS } from "./imports.mjs";

function fixture(t, files = {}, config = {}) {
  const root = mkdtempSync(join(tmpdir(), "feature-cycles-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
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

test("没有 features 目录或当前文件不属于 feature 时不报告", (t) => {
  const root = fixture(t);
  const checkFile = createFeatureCycleChecker(root);
  assert.deepEqual(checkFile(join(root, "app/page.ts"), "export {};"), []);
});

test("同 feature 导入和单向跨 feature 依赖允许", (t) => {
  const root = fixture(t, {
    "features/a/index.ts": 'export { value } from "./hooks/value";',
    "features/a/hooks/value.ts":
      'import { value as other } from "@/features/b"; export const value = other;',
    "features/b/index.ts": 'export { value } from "./hooks/value";',
    "features/b/hooks/value.ts": "export const value = 1;",
  });
  const checkFile = createFeatureCycleChecker(root);
  assert.deepEqual(check(root, "features/a/index.ts", checkFile), []);
  assert.deepEqual(check(root, "features/a/hooks/value.ts", checkFile), []);
});

test("文件图无环时仍能发现两个 feature 互相依赖", (t) => {
  const root = fixture(t, {
    "features/a/index.ts": "export const a = 1;",
    "features/a/components/consumer.ts":
      '\nimport { b } from "@/features/b"; export const value = b;',
    "features/b/index.ts": "export const b = 1;",
    "features/b/components/consumer.ts":
      'import { a } from "@/features/a"; export const value = a;',
  });
  assert.deepEqual(check(root, "features/a/components/consumer.ts"), [
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

test("发现三个 feature 的间接循环，只报告当前文件参与的循环", (t) => {
  const root = fixture(t, {
    "features/c/index.ts": 'export * from "@/features/a";',
    "features/b/index.ts": 'export * from "@/features/c";',
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/z/index.ts": 'export * from "@/features/y";',
    "features/y/index.ts": 'export * from "@/features/z";',
  });
  const checkFile = createFeatureCycleChecker(root);
  const cycles = check(root, "features/a/index.ts", checkFile);
  assert.deepEqual(
    cycles.map(({ cycle }) => cycle),
    [["a", "b", "c", "a"]],
  );
  assert.deepEqual(
    check(root, "features/y/index.ts", checkFile).map(({ cycle }) => cycle),
    [["y", "z", "y"]],
  );
  assert.deepEqual(check(root, "features/a/index.ts", checkFile), cycles);
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
  test(`${name} 纳入 feature 图`, (t) => {
    const root = fixture(t, {
      "features/a/index.ts": source,
      "features/b/index.ts":
        'export type Item = {}; export * from "@/features/a";',
    });
    assert.deepEqual(
      check(root, "features/a/index.ts").map(({ cycle }) => cycle),
      [["a", "b", "a"]],
    );
  });
}

for (const extension of SOURCE_EXTENSIONS) {
  test(`扫描 .${extension} 文件`, (t) => {
    const root = fixture(t, {
      [`features/a/index.${extension}`]: `export * from "@/features/b/index.${extension}";`,
      [`features/b/index.${extension}`]: `export * from "@/features/a/index.${extension}";`,
    });
    assert.deepEqual(
      check(root, `features/a/index.${extension}`).map(({ cycle }) => cycle),
      [["a", "b", "a"]],
    );
  });
}

test("相对路径跨 feature 依赖仍纳入循环检查", (t) => {
  const root = fixture(t, {
    "features/a/index.ts": 'export * from "../b";',
    "features/b/index.ts": 'export * from "../a";',
  });
  assert.deepEqual(
    check(root, "features/a/index.ts").map(({ cycle }) => cycle),
    [["a", "b", "a"]],
  );
});

test("声明文件的类型依赖纳入 feature 图", (t) => {
  const root = fixture(t, {
    "features/a/index.d.ts": 'export type Item = import("@/features/b").Item;',
    "features/b/index.d.ts": 'export type Item = import("@/features/a").Item;',
  });
  assert.deepEqual(
    check(root, "features/a/index.d.ts").map(({ cycle }) => cycle),
    [["a", "b", "a"]],
  );
});

test("忽略生成目录、第三方模块和无法静态判断的动态导入", (t) => {
  const root = fixture(t, {
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/b/index.ts":
      'import "react"; export const value = import(`@/features/${name}`);',
    "features/b/.next/generated.ts": 'export * from "@/features/a";',
    "features/b/node_modules/package/index.ts": 'export * from "@/features/a";',
  });
  assert.deepEqual(check(root, "features/a/index.ts"), []);
});

test("按 tsconfig 的实际别名解析依赖", (t) => {
  const root = fixture(
    t,
    {
      "features/a/index.ts": 'export * from "@/public/b";',
      "features/b/index.ts": 'export * from "@/public/a";',
    },
    { paths: { "@/public/*": ["./features/*"] } },
  );
  assert.deepEqual(
    check(root, "features/a/index.ts").map(({ cycle }) => cycle),
    [["a", "b", "a"]],
  );
});

test("共享 resolver 读取 extends 和 moduleSuffixes", (t) => {
  const root = fixture(t, {
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
  assert.equal(imported.target, join(root, "features/a/index.native.ts"));
  assert.equal(imported.isAlias, true);
});

test("共享 resolver 对未解析路径规范化，第三方包不参与项目路径检查", (t) => {
  const root = fixture(t);
  const resolveImport = createProjectResolver(root);
  assert.deepEqual(
    resolveImport(join(root, "features/a/index.ts"), "../b/../c/missing"),
    {
      target: join(root, "features/c/missing"),
      isRelative: true,
      isAlias: false,
    },
  );
  assert.equal(resolveImport(join(root, "app/page.ts"), "react"), null);
});

test("同一 checker 读取磁盘内容变化，不以时间戳或文件大小复用旧依赖", (t) => {
  const source = 'export * from "@/features/b";';
  const root = fixture(t, {
    "features/a/index.ts": source,
    "features/b/index.ts": 'export * from "@/features/c";',
    "features/c/index.ts": "export const value = 1;",
  });
  const checkFile = createFeatureCycleChecker(root);
  const target = join(root, "features/b/index.ts");
  const timestamp = new Date("2026-01-01T00:00:00.000Z");
  utimesSync(target, timestamp, timestamp);
  const before = statSync(target);
  assert.deepEqual(check(root, "features/a/index.ts", checkFile), []);
  write(root, "features/b/index.ts", 'export * from "@/features/a";');
  utimesSync(target, timestamp, timestamp);
  const after = statSync(target);
  assert.equal(after.size, before.size);
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.deepEqual(
    checkFile(join(root, "features/a/index.ts"), source).map(
      ({ cycle }) => cycle,
    ),
    [["a", "b", "a"]],
  );
  write(root, "features/b/index.ts", "export const value = 1;");
  assert.deepEqual(check(root, "features/a/index.ts", checkFile), []);
});

test("同一 checker 跟踪依赖文件新增、删除及跨目录重命名", (t) => {
  const root = fixture(t, {
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/b/index.ts": "export const value = 1;",
    "features/c/index.ts": "export const value = 1;",
  });
  const checkFile = createFeatureCycleChecker(root);
  const current = () => check(root, "features/a/index.ts", checkFile);
  assert.deepEqual(current(), []);
  write(root, "features/b/consumer.ts", 'export * from "@/features/a";');
  assert.equal(current().length, 1);
  renameSync(
    join(root, "features/b/consumer.ts"),
    join(root, "features/c/consumer.ts"),
  );
  assert.deepEqual(current(), []);
  renameSync(
    join(root, "features/c/consumer.ts"),
    join(root, "features/b/renamed.ts"),
  );
  assert.equal(current().length, 1);
  rmSync(join(root, "features/b/renamed.ts"));
  assert.deepEqual(current(), []);
});

test("同一 checker 跟踪整个 feature 目录新增、重命名和删除", (t) => {
  const root = fixture(t, {
    "features/a/index.ts": 'export * from "@/features/b";',
  });
  const checkFile = createFeatureCycleChecker(root);
  const current = () => check(root, "features/a/index.ts", checkFile);
  assert.deepEqual(current(), []);
  write(root, "features/b/index.ts", 'export * from "@/features/a";');
  assert.equal(current().length, 1);
  renameSync(join(root, "features/b"), join(root, "features/c"));
  assert.deepEqual(current(), []);
  renameSync(join(root, "features/c"), join(root, "features/b"));
  assert.equal(current().length, 1);
  rmSync(join(root, "features/b"), { recursive: true });
  assert.deepEqual(current(), []);
});

test("同一 checker 重新读取 tsconfig 及 extends 中的别名", (t) => {
  const root = fixture(t, {
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
  assert.deepEqual(current(), []);
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
  assert.deepEqual(
    current().map(({ cycle }) => cycle),
    [["a", "b", "a"]],
  );
  write(
    root,
    "tsconfig.json",
    JSON.stringify({
      extends: "./tsconfig.base.json",
      compilerOptions: { paths: { "@/peer": ["./features/c"] } },
    }),
  );
  assert.deepEqual(current(), []);
});

test("配置变化让当前文件退出 feature 图后，其他文件也使用新的解析结果", (t) => {
  const root = fixture(
    t,
    {
      "features/a/index.ts": 'export * from "@/peer";',
      "features/b/index.ts": 'export * from "@/features/a";',
      "lib/peer.ts": "export const value = 1;",
    },
    { paths: { "@/*": ["./*"], "@/peer": ["./features/b"] } },
  );
  const checkFile = createFeatureCycleChecker(root);
  assert.equal(check(root, "features/a/index.ts", checkFile).length, 1);
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
  assert.deepEqual(check(root, "features/a/index.ts", checkFile), []);
  assert.deepEqual(check(root, "features/b/index.ts", checkFile), []);
});

test("原子替换文件后即使大小和 mtime 相同也更新依赖", (t) => {
  const root = fixture(t, {
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/b/index.ts": 'export * from "@/features/c";',
    "features/c/index.ts": "export const value = 1;",
  });
  const checkFile = createFeatureCycleChecker(root);
  const target = join(root, "features/b/index.ts");
  const before = statSync(target);
  assert.deepEqual(check(root, "features/a/index.ts", checkFile), []);
  const replacement = join(root, "replacement.ts");
  writeFileSync(replacement, 'export * from "@/features/a";', "utf8");
  utimesSync(replacement, before.atime, before.mtime);
  renameSync(replacement, target);
  assert.equal(statSync(target).size, before.size);
  assert.equal(check(root, "features/a/index.ts", checkFile).length, 1);
});

test("新增或删除优先解析目标会使已有文件的依赖失效", (t) => {
  const root = fixture(
    t,
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
  assert.deepEqual(current(), []);
  write(root, "features/b/preferred.ts", "export const value = 1;");
  assert.equal(current().length, 1);
  rmSync(join(root, "features/b/preferred.ts"));
  assert.deepEqual(current(), []);
});

test("无效配置不会回退到旧 resolver，修正后同一 checker 可以恢复", (t) => {
  const root = fixture(t, {
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/b/index.ts": 'export * from "@/features/a";',
  });
  const checkFile = createFeatureCycleChecker(root);
  const current = () => check(root, "features/a/index.ts", checkFile);
  assert.equal(current().length, 1);
  const config = readFileSync(join(root, "tsconfig.json"), "utf8");
  write(root, "tsconfig.json", "{");
  assert.throws(current);
  assert.throws(current);
  write(root, "tsconfig.json", config);
  assert.equal(current().length, 1);
});

test("未保存的当前文本覆盖磁盘版本，后续调用不会保留旧的覆盖内容", (t) => {
  const root = fixture(t, {
    "features/a/index.ts": "export const value = 1;",
    "features/b/index.ts": 'export * from "@/features/a";',
  });
  const checkFile = createFeatureCycleChecker(root);
  const filename = join(root, "features/a/index.ts");
  assert.deepEqual(check(root, "features/a/index.ts", checkFile), []);
  assert.deepEqual(
    checkFile(filename, 'export * from "@/features/b";').map(
      ({ cycle }) => cycle,
    ),
    [["a", "b", "a"]],
  );
  assert.deepEqual(check(root, "features/b/index.ts", checkFile), []);
  assert.deepEqual(check(root, "features/a/index.ts", checkFile), []);
  write(root, "features/a/index.ts", 'export * from "@/features/b";');
  assert.deepEqual(checkFile(filename, "export const value = 1;"), []);
  assert.equal(check(root, "features/a/index.ts", checkFile).length, 1);
});

test("尚未落盘的新文件也按传入文本参与 feature 图", (t) => {
  const root = fixture(t, {
    "features/b/index.ts": 'export * from "@/features/a/new-file";',
  });
  const checkFile = createFeatureCycleChecker(root);
  assert.deepEqual(
    checkFile(
      join(root, "features/a/new-file.ts"),
      'export * from "@/features/b";',
    ).map(({ cycle }) => cycle),
    [["a", "b", "a"]],
  );
});

test("同一 feature 边的每个当前引用都报告，不局限于代表文件", (t) => {
  const root = fixture(t, {
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/a/consumer.ts":
      'export * from "@/features/b";\nexport type Item = import("@/features/b").Item;',
    "features/b/index.ts": 'export * from "@/features/a";',
  });
  const checkFile = createFeatureCycleChecker(root);
  assert.equal(check(root, "features/a/index.ts", checkFile).length, 1);
  const reports = check(root, "features/a/consumer.ts", checkFile);
  assert.deepEqual(
    reports.map(({ line }) => line),
    [1, 2],
  );
  assert.deepEqual(
    reports.map(({ cycle }) => cycle),
    [
      ["a", "b", "a"],
      ["a", "b", "a"],
    ],
  );
});

test("其他 feature 的独立循环不会影响当前单向引用", (t) => {
  const root = fixture(t, {
    "features/a/index.ts": 'export * from "@/features/b";',
    "features/b/index.ts": "export const value = 1;",
    "features/c/index.ts": 'export * from "@/features/d";',
    "features/d/index.ts": 'export * from "@/features/c";',
  });
  assert.deepEqual(check(root, "features/a/index.ts"), []);
});
