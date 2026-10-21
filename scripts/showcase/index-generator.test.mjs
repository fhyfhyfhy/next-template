import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import {
  generateExampleIndexes,
  watchExampleIndexes,
} from "./index-generator.mjs";

const featurePath = "features/component-showcase";
let moduleVersion = 0;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "showcase-indexes-"));
  mkdirSync(join(root, featurePath, "components"), { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function componentPath(root, component, filename = "") {
  return join(
    root,
    featurePath,
    "components",
    `${component}-examples`,
    filename,
  );
}

function write(
  root,
  component,
  filename,
  content = "throw new Error('never');",
) {
  const path = componentPath(root, component, filename);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function metadata(overrides = {}) {
  return {
    title: "Example",
    description: "Example component",
    icon: "IconCheck",
    ...overrides,
  };
}

function demo(overrides = {}) {
  return `export const metadata = ${JSON.stringify(metadata(overrides))} satisfies ComponentMetadata;
export function Demo() { return <div />; }`;
}

function component(root, id, overrides = {}) {
  write(root, id, "demo.tsx", demo(overrides));
  for (const filename of ["playground.tsx", "index.ts"])
    write(root, id, filename);
}

function sourceIndexPath(root) {
  return join(root, featurePath, "constants/example-files.generated.ts");
}

function registrySource(root) {
  return readFileSync(
    join(root, featurePath, "components/example-list/registry.generated.ts"),
    "utf8",
  );
}

function readSources(root) {
  return import(
    `${pathToFileURL(sourceIndexPath(root)).href}?version=${moduleVersion++}`
  );
}

function readCatalog(root) {
  const filename = join(root, featurePath, "constants/catalog.generated.ts");
  return import(`${pathToFileURL(filename).href}?version=${moduleVersion++}`);
}

function componentRegistrySource(root) {
  return readFileSync(
    join(root, featurePath, "components/component-registry.generated.ts"),
    "utf8",
  );
}

async function eventually(check) {
  const deadline = Date.now() + 5000;
  while (true) {
    try {
      await check();
      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await setTimeout(20);
    }
  }
}

test("自动发现零个、一个和三个示例，忽略辅助文件与嵌套目录", async (t) => {
  const root = fixture(t);
  for (const id of ["empty", "button", "checkbox"]) component(root, id);
  write(root, "button", "basic.example.tsx");
  write(root, "checkbox", "select-all.example.tsx");
  write(root, "checkbox", "basic.example.tsx");
  write(root, "checkbox", "disabled.example.tsx");
  write(root, "checkbox", "playground.tsx");
  write(root, "checkbox", "helper.tsx");
  write(root, "checkbox", "ignored.example.ts");
  write(root, "checkbox", "nested/ignored.example.tsx");
  mkdirSync(componentPath(root, "checkbox", "folder.example.tsx"));

  await generateExampleIndexes(root);
  const { exampleFiles } = await readSources(root);
  assert.deepEqual(exampleFiles, {
    button: [{ id: "basic", filename: "basic.example.tsx" }],
    checkbox: [
      { id: "basic", filename: "basic.example.tsx" },
      { id: "disabled", filename: "disabled.example.tsx" },
      { id: "select-all", filename: "select-all.example.tsx" },
    ],
    empty: [],
  });
  const checkboxIndex = readFileSync(
    componentPath(root, "checkbox", "examples.generated.ts"),
    "utf8",
  );
  assert.match(checkboxIndex, /"use client";/);
  assert.match(checkboxIndex, /from "\.\/select-all\.example"/);
  assert.match(checkboxIndex, /satisfies readonly ExampleDefinition\[\]/);
  assert.doesNotMatch(checkboxIndex, /playground|helper|ignored|folder/);
  assert.match(registrySource(root), /from "\.\.\/empty-examples";/);
  assert.doesNotMatch(registrySource(root), /examples\.generated/);
});

test("没有组件目录时明确报错，不生成无法使用的空目录", async (t) => {
  const root = fixture(t);
  await assert.rejects(
    generateExampleIndexes(root),
    /Expected at least one showcase component directory/,
  );
  assert.equal(existsSync(sourceIndexPath(root)), false);
});

test("组件目录按 order 和 id 排序，Demo 与去重的图标使用静态公开导入", async (t) => {
  const root = fixture(t);
  component(root, "zebra", {
    title: "Last",
    description: "Last component",
    order: 2,
    icon: "IconZoom",
  });
  component(root, "beta", { title: "Beta", order: 0 });
  component(root, "alpha", { title: "Alpha" });
  component(root, "first", { title: "First", order: -1 });
  await generateExampleIndexes(root);

  const { catalog } = await readCatalog(root);
  assert.deepEqual(
    catalog.map(({ id }) => id),
    ["first", "alpha", "beta", "zebra"],
  );
  assert.deepEqual(catalog.at(-1), {
    id: "zebra",
    title: "Last",
    description: "Last component",
  });
  const registry = componentRegistrySource(root);
  assert.match(
    registry,
    /import \{ IconCheck, IconZoom \} from "@tabler\/icons-react";/,
  );
  assert.match(registry, /import \{ Demo as \w+ \} from "\.\/alpha-examples";/);
  assert.match(registry, /export const demosByComponent =/);
  assert.match(registry, /export const iconsByComponent =/);
  assert.doesNotMatch(registry, /use client|\/demo"/);
});

test("静态读取带注释和类型包装的字面量，不执行 TSX 或加载其依赖", async (t) => {
  const root = fixture(t);
  component(root, "wrapped");
  component(root, "plain");
  write(
    root,
    "wrapped",
    "demo.tsx",
    `
import "missing-runtime-package-that-must-not-load";
throw new Error("This module must never execute");
export const metadata = (({
  // metadata 始终来自本文件的字面量。
  "title": ("Wrapped" as const),
  description: \`Template description\`,
  icon: "IconCheck",
  order: -(2),
} as const) satisfies ComponentMetadata);
export function Demo() { return <div>{unknownRuntimeValue}</div>; }
`,
  );
  write(
    root,
    "plain",
    "demo.tsx",
    `export const metadata = {
      title: "Plain",
      description: "Plain description",
      icon: "IconPlus",
      order: +2,
    };
    export function Demo() { throw new Error("Never execute"); }`,
  );

  await generateExampleIndexes(root);
  assert.deepEqual((await readCatalog(root)).catalog, [
    { id: "wrapped", title: "Wrapped", description: "Template description" },
    { id: "plain", title: "Plain", description: "Plain description" },
  ]);
});

test("metadata 无效或缺少必需文件时保留所有旧生成物", async (t) => {
  const root = fixture(t);
  component(root, "button");
  component(root, "checkbox");
  const generated = await generateExampleIndexes(root);
  const previous = generated.map((filename) => readFileSync(filename, "utf8"));
  write(root, "button", "demo.tsx", demo({ title: "New" }));
  const invalidMetadata = [
    ["export const metadata = {", /Cannot parse showcase metadata/],
    ["export const metadata = [];", /Expected a metadata object literal/],
    ["export const metadata = null;", /Expected a metadata object literal/],
    [demo({ title: "  " }), /Expected a non-empty title/],
    [demo({ description: 1 }), /Expected a non-empty description/],
    [
      demo({ icon: 'IconCheck } from "unsafe"' }),
      /Expected a Tabler icon export name/,
    ],
    [demo({ icon: null }), /Expected literal metadata values/],
    [demo({ order: "1" }), /Expected a finite order/],
    [demo({ order: null }), /Expected literal metadata values/],
    [
      demo().replace("satisfies ComponentMetadata", "satisfies"),
      /Cannot parse showcase metadata/,
    ],
    [
      demo().replace('"icon":"IconCheck"', '"icon":"IconCheck","order":1e999'),
      /Expected a finite order/,
    ],
    [
      "export function Demo() { return null; }",
      /Expected exactly one exported const metadata/,
    ],
    [`${demo()}\n${demo()}`, /Expected exactly one exported const metadata/],
    [
      demo().replace("export const metadata", "const metadata"),
      /Expected exported const metadata/,
    ],
    [
      demo().replace("export const metadata", "export let metadata"),
      /Expected exported const metadata/,
    ],
    [
      demo().replace('"title":"Example"', "title: externalTitle"),
      /Expected literal metadata values/,
    ],
    [
      demo().replace('"title":"Example"', "title: getTitle()"),
      /Expected literal metadata values/,
    ],
    [
      demo().replace('"title":"Example"', "title: `Hello ${externalTitle}`"),
      /Expected literal metadata values/,
    ],
    [
      demo().replace('"title":"Example"', '["title"]: "Example"'),
      /Expected non-computed metadata property assignments/,
    ],
    [
      demo().replace('"title":"Example"', "...shared"),
      /Expected non-computed metadata property assignments/,
    ],
    [
      demo().replace('"title":"Example"', "title"),
      /Expected non-computed metadata property assignments/,
    ],
    [
      demo().replace('"title":"Example"', 'title: "One", "title": "Two"'),
      /Duplicate metadata property/,
    ],
    [
      demo().replace('"title":"Example"', 'get title() { return "Example"; }'),
      /Expected non-computed metadata property assignments/,
    ],
  ];
  for (const [source, expectedError] of invalidMetadata) {
    write(root, "checkbox", "demo.tsx", source);
    await assert.rejects(generateExampleIndexes(root), (error) => {
      assert.match(error.message, expectedError);
      assert.ok(
        error.message.includes(componentPath(root, "checkbox", "demo.tsx")),
      );
      return true;
    });
    assert.deepEqual(
      generated.map((filename) => readFileSync(filename, "utf8")),
      previous,
    );
  }
  write(root, "checkbox", "demo.tsx", demo());
  for (const filename of ["demo.tsx", "playground.tsx", "index.ts"]) {
    const path = componentPath(root, "checkbox", filename);
    const source = readFileSync(path, "utf8");
    rmSync(path);
    await assert.rejects(
      generateExampleIndexes(root),
      /Missing required showcase file/,
    );
    assert.deepEqual(
      generated.map((filename) => readFileSync(filename, "utf8")),
      previous,
    );
    write(root, "checkbox", filename, source);
  }
});

test("删除、重命名示例和目录后不保留过期的引用", async (t) => {
  const root = fixture(t);
  component(root, "checkbox");
  component(root, "button");
  write(root, "checkbox", "basic.example.tsx");
  write(root, "checkbox", "disabled.example.tsx");
  write(root, "button", "basic.example.tsx");
  await generateExampleIndexes(root);

  renameSync(
    componentPath(root, "checkbox", "basic.example.tsx"),
    componentPath(root, "checkbox", "select-all.example.tsx"),
  );
  rmSync(componentPath(root, "checkbox", "disabled.example.tsx"));
  rmSync(componentPath(root, "button"), { recursive: true });
  await generateExampleIndexes(root);

  assert.deepEqual((await readSources(root)).exampleFiles, {
    checkbox: [{ id: "select-all", filename: "select-all.example.tsx" }],
  });
  const index = readFileSync(
    componentPath(root, "checkbox", "examples.generated.ts"),
    "utf8",
  );
  assert.doesNotMatch(index, /basic|disabled/);
  assert.doesNotMatch(registrySource(root), /button/);
  assert.doesNotMatch(componentRegistrySource(root), /button/);
  assert.deepEqual(
    (await readCatalog(root)).catalog.map(({ id }) => id),
    ["checkbox"],
  );
});

test("相同输入不重写文件，源码变化只更新源码索引的内容摘要", async (t) => {
  const root = fixture(t);
  component(root, "checkbox");
  write(root, "checkbox", "basic.example.tsx", "export const value = 1;");
  write(root, "checkbox", "playground.tsx", "export const value = 1;");
  const generated = await generateExampleIndexes(root);
  const mtimes = generated.map((filename) => statSync(filename).mtimeMs);
  const initial = await readSources(root);

  assert.deepEqual(await generateExampleIndexes(root), []);
  assert.deepEqual(
    generated.map((filename) => statSync(filename).mtimeMs),
    mtimes,
  );
  for (const filename of ["basic.example.tsx", "playground.tsx"]) {
    const previous = await readSources(root);
    write(root, "checkbox", filename, "export const value = 2;");
    assert.deepEqual(await generateExampleIndexes(root), [
      sourceIndexPath(root),
    ]);
    const current = await readSources(root);
    assert.notEqual(
      current.exampleSourceRevision,
      previous.exampleSourceRevision,
    );
    assert.deepEqual(current.exampleFiles, initial.exampleFiles);
  }
});

test("非法示例名称在写入索引前报错", async (t) => {
  const root = fixture(t);
  component(root, "checkbox");
  write(root, "checkbox", "Bad_name.example.tsx");
  await assert.rejects(
    generateExampleIndexes(root),
    /Expected a kebab-case showcase ID: Bad_name\.example\.tsx/,
  );
});

test("LF 和 CRLF 源码生成相同摘要", async (t) => {
  const root = fixture(t);
  component(root, "checkbox");
  const content = "export const value = 1;\nexport const label = 'Example';\n";
  write(root, "checkbox", "basic.example.tsx", content);
  write(root, "checkbox", "playground.tsx", content);
  await generateExampleIndexes(root);
  const initial = await readSources(root);

  for (const filename of ["basic.example.tsx", "playground.tsx"]) {
    write(root, "checkbox", filename, content.replace(/\n/g, "\r\n"));
    assert.deepEqual(await generateExampleIndexes(root), []);
    assert.equal(
      (await readSources(root)).exampleSourceRevision,
      initial.exampleSourceRevision,
    );
  }
});

test("watch 自动处理文件和目录增删、重命名及源码内容修改", async (t) => {
  const root = fixture(t);
  component(root, "anchor");
  const errors = [];
  const watcher = await watchExampleIndexes(root, {
    onError: (error) => errors.push(error),
  });
  t.after(() => watcher.close());

  component(root, "checkbox");
  write(root, "checkbox", "basic.example.tsx", "export const value = 1;");
  write(root, "checkbox", "disabled.example.tsx");
  write(root, "checkbox", "select-all.example.tsx");
  await eventually(async () => {
    assert.equal((await readSources(root)).exampleFiles.checkbox?.length, 3);
    assert.deepEqual(
      (await readCatalog(root)).catalog.map(({ id }) => id),
      ["anchor", "checkbox"],
    );
  });

  for (const filename of ["basic.example.tsx", "playground.tsx"]) {
    const previous = (await readSources(root)).exampleSourceRevision;
    write(root, "checkbox", filename, "export const value = 2;");
    await eventually(async () => {
      assert.notEqual(
        (await readSources(root)).exampleSourceRevision,
        previous,
      );
    });
  }

  renameSync(
    componentPath(root, "checkbox", "basic.example.tsx"),
    componentPath(root, "checkbox", "renamed.example.tsx"),
  );
  rmSync(componentPath(root, "checkbox", "disabled.example.tsx"));
  await eventually(async () => {
    assert.deepEqual((await readSources(root)).exampleFiles.checkbox, [
      { id: "renamed", filename: "renamed.example.tsx" },
      { id: "select-all", filename: "select-all.example.tsx" },
    ]);
  });

  renameSync(componentPath(root, "checkbox"), componentPath(root, "button"));
  await eventually(async () => {
    const { exampleFiles } = await readSources(root);
    assert.deepEqual(Object.keys(exampleFiles), ["anchor", "button"]);
    assert.match(registrySource(root), /button-examples/);
    assert.doesNotMatch(registrySource(root), /checkbox-examples/);
    assert.match(componentRegistrySource(root), /button-examples/);
    assert.doesNotMatch(componentRegistrySource(root), /checkbox-examples/);
    assert.deepEqual(
      (await readCatalog(root)).catalog.map(({ id }) => id),
      ["anchor", "button"],
    );
  });
  rmSync(componentPath(root, "button"), { recursive: true });
  await eventually(async () => {
    assert.deepEqual((await readSources(root)).exampleFiles, { anchor: [] });
    assert.deepEqual(
      (await readCatalog(root)).catalog.map(({ id }) => id),
      ["anchor"],
    );
  });
  assert.deepEqual(errors, []);
});

test("watch 校验 demo metadata 与必需文件，并在修正后恢复生成", async (t) => {
  const root = fixture(t);
  component(root, "checkbox");
  const errors = [];
  const watcher = await watchExampleIndexes(root, {
    onError: (error) => errors.push(error),
  });
  t.after(() => watcher.close());
  const initialCatalog = (await readCatalog(root)).catalog;

  write(root, "checkbox", "demo.tsx", "export const metadata = {");
  await eventually(() =>
    assert.match(errors.at(-1)?.message ?? "", /Cannot parse/),
  );
  assert.deepEqual((await readCatalog(root)).catalog, initialCatalog);

  write(
    root,
    "checkbox",
    "demo.tsx",
    demo({ title: "Updated", icon: "IconPlus" }),
  );
  await eventually(async () => {
    assert.equal((await readCatalog(root)).catalog[0].title, "Updated");
    assert.match(componentRegistrySource(root), /IconPlus/);
  });

  for (const filename of ["demo.tsx", "playground.tsx", "index.ts"]) {
    const errorCount = errors.length;
    const path = componentPath(root, "checkbox", filename);
    const source = readFileSync(path, "utf8");
    rmSync(path);
    await eventually(() => {
      assert.ok(errors.length > errorCount);
      assert.match(errors.at(-1).message, /Missing required showcase file/);
    });
    write(root, "checkbox", filename, source);
    write(root, "checkbox", "demo.tsx", demo({ title: filename }));
    await eventually(async () => {
      assert.equal((await readCatalog(root)).catalog[0].title, filename);
    });
  }

  rmSync(componentPath(root, "checkbox"), { recursive: true });
  await eventually(() =>
    assert.match(
      errors.at(-1)?.message ?? "",
      /Expected at least one showcase component directory/,
    ),
  );
  component(root, "button");
  await eventually(async () => {
    assert.deepEqual(
      (await readCatalog(root)).catalog.map(({ id }) => id),
      ["button"],
    );
  });
});
