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
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { expect, onTestFinished, test } from "vitest";

import {
  generateExampleIndexes,
  watchExampleIndexes,
} from "./index-generator.mjs";

const featurePath = "features/ui-catalog";
let moduleVersion = 0;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ui-catalog-indexes-"));
  mkdirSync(join(root, featurePath, "components"), { recursive: true });
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
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
    icon: "IconCheck",
    ...overrides,
  };
}

function preview(overrides = {}) {
  return `export const metadata = ${JSON.stringify(metadata(overrides))} satisfies ComponentMetadata;
export function Preview() { return <div />; }`;
}

function component(root, id, overrides = {}) {
  write(root, id, "preview.tsx", preview(overrides));
  for (const filename of ["playground.tsx", "index.ts"])
    write(root, id, filename);
}

function sourceIndexPath(root) {
  return join(root, featurePath, "constants/example-files.generated.ts");
}

function registryPath(root) {
  return join(
    root,
    featurePath,
    "components/example-list/registry.generated.ts",
  );
}

function catalogPath(root) {
  return join(root, featurePath, "constants/catalog.generated.ts");
}

function componentRegistryPath(root) {
  return join(root, featurePath, "components/component-registry.generated.ts");
}

function registrySource(root) {
  return readFileSync(registryPath(root), "utf8");
}

function readSources(root) {
  return import(
    `${pathToFileURL(sourceIndexPath(root)).href}?version=${moduleVersion++}`
  );
}

function readCatalog(root) {
  return import(
    `${pathToFileURL(catalogPath(root)).href}?version=${moduleVersion++}`
  );
}

function componentRegistrySource(root) {
  return readFileSync(componentRegistryPath(root), "utf8");
}

/** 这些组件的索引和四个共用索引里，已经写到磁盘上的那些。 */
function writtenIndexes(root, ids) {
  return [
    ...ids.map((id) => componentPath(root, id, "examples.generated.ts")),
    sourceIndexPath(root),
    registryPath(root),
    catalogPath(root),
    componentRegistryPath(root),
  ].filter((filename) => existsSync(filename));
}

// 用到它的用例，超时要比这 5 秒长：否则失败时报的是用例超时，看不到最后一次断言的差异。
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

test("自动发现零个、一个和三个示例，忽略辅助文件", async () => {
  const root = fixture();
  for (const id of ["empty", "button", "checkbox"]) component(root, id);
  write(root, "button", "basic.example.tsx");
  write(root, "checkbox", "select-all.example.tsx");
  write(root, "checkbox", "basic.example.tsx");
  write(root, "checkbox", "disabled.example.tsx");
  write(root, "checkbox", "playground.tsx");
  write(root, "checkbox", "helper.tsx");
  write(root, "checkbox", "ignored.example.ts");

  await generateExampleIndexes(root);
  const { exampleFiles } = await readSources(root);
  expect(exampleFiles).toStrictEqual({
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
  expect(checkboxIndex).toMatch(/"use client";/);
  expect(checkboxIndex).toMatch(/from "\.\/select-all\.example"/);
  expect(checkboxIndex).toMatch(/satisfies readonly ExampleDefinition\[\]/);
  expect(checkboxIndex).not.toMatch(/playground|helper|ignored/);
  expect(registrySource(root)).toMatch(/from "\.\.\/empty-examples";/);
  expect(registrySource(root)).toMatch(
    /import \{ examples as (\w+) \} from "\.\.\/checkbox-examples";[\s\S]*checkbox: \1,/,
  );
  expect(registrySource(root)).not.toMatch(/examples\.generated/);
});

test("示例目录里有子目录时报错，不写入任何索引", async () => {
  for (const nested of [
    "nested/basic.example.tsx",
    "folder.example.tsx/basic.tsx",
  ]) {
    const root = fixture();
    // 和"非法示例名称在写入索引前报错"一样，anchor 先通过校验：边校验边写的话，它的索引会留下来。
    component(root, "anchor");
    component(root, "checkbox");
    write(root, "checkbox", nested);

    await expect(generateExampleIndexes(root)).rejects.toThrow(
      `Expected only files in a UI catalog examples directory: ${componentPath(root, "checkbox", dirname(nested))}`,
    );
    expect(writtenIndexes(root, ["anchor", "checkbox"])).toStrictEqual([]);
  }
});

test("按生成物所在位置的 Prettier 配置格式化", async () => {
  const root = fixture();
  writeFileSync(join(root, ".prettierrc"), JSON.stringify({ semi: false }));
  component(root, "checkbox");
  write(root, "checkbox", "basic.example.tsx");

  const generated = await generateExampleIndexes(root);
  expect(generated).toHaveLength(5);
  for (const filename of generated) {
    expect(readFileSync(filename, "utf8"), filename).not.toMatch(/;$/m);
  }
  expect(
    readFileSync(
      componentPath(root, "checkbox", "examples.generated.ts"),
      "utf8",
    ),
  ).toMatch(/^"use client"$/m);
});

test("没有组件目录时明确报错，不生成无法使用的空目录", async () => {
  const root = fixture();
  await expect(generateExampleIndexes(root)).rejects.toThrow(
    /Expected at least one UI catalog component directory/,
  );
  expect(existsSync(sourceIndexPath(root))).toBe(false);
});

test("组件目录按 order 和 id 排序，Preview 与去重的图标使用静态公开导入", async () => {
  const root = fixture();
  component(root, "zebra", {
    title: "Last",
    order: 2,
    icon: "IconZoom",
  });
  component(root, "beta", { title: "Beta", order: 0 });
  component(root, "alpha", { title: "Alpha" });
  component(root, "first", { title: "First", order: -1 });
  await generateExampleIndexes(root);

  const { catalog } = await readCatalog(root);
  expect(catalog.map(({ id }) => id)).toStrictEqual([
    "first",
    "alpha",
    "beta",
    "zebra",
  ]);
  expect(catalog.at(-1)).toStrictEqual({ id: "zebra", title: "Last" });
  const registry = componentRegistrySource(root);
  expect(registry).toMatch(
    /import \{ IconCheck, IconZoom \} from "@tabler\/icons-react";/,
  );
  expect(registry).toMatch(
    /import \{ Preview as \w+ \} from "\.\/alpha-examples";/,
  );
  // 用反向引用比对绑定名：每个 ID 配到自己目录的 Preview，错位一格就对不上；绑定名怎么起都成立。
  expect(registry).toMatch(
    /import \{ Preview as (\w+) \} from "\.\/zebra-examples";[\s\S]*zebra: \1,/,
  );
  expect(registry).toMatch(/zebra: IconZoom,/);
  expect(registry).toMatch(/export const previewsByComponent =/);
  expect(registry).toMatch(/export const iconsByComponent =/);
  expect(registry).not.toMatch(/use client|\/preview"/);
});

test("静态读取带注释和类型包装的字面量，不执行 TSX 或加载其依赖", async () => {
  const root = fixture();
  component(root, "wrapped");
  component(root, "plain");
  write(
    root,
    "wrapped",
    "preview.tsx",
    `
import "missing-runtime-package-that-must-not-load";
throw new Error("This module must never execute");
export const metadata = (({
  // metadata 始终来自本文件的字面量。
  "title": ("Wrapped" as const),
  icon: \`IconCheck\`,
  order: -(2),
} as const) satisfies ComponentMetadata);
export function Preview() { return <div>{unknownRuntimeValue}</div>; }
`,
  );
  write(
    root,
    "plain",
    "preview.tsx",
    `export const metadata = {
      title: "Plain",
      icon: "IconPlus",
      order: +2,
    };
    export function Preview() { throw new Error("Never execute"); }`,
  );

  await generateExampleIndexes(root);
  expect((await readCatalog(root)).catalog).toStrictEqual([
    { id: "wrapped", title: "Wrapped" },
    { id: "plain", title: "Plain" },
  ]);
});

test("metadata 无效或缺少必需文件时保留所有旧生成物", async () => {
  const root = fixture();
  component(root, "button");
  component(root, "checkbox");
  const generated = await generateExampleIndexes(root);
  const previous = generated.map((filename) => readFileSync(filename, "utf8"));
  write(root, "button", "preview.tsx", preview({ title: "New" }));
  const invalidMetadata = [
    ["export const metadata = {", /Cannot parse UI catalog metadata/],
    ["export const metadata = [];", /Expected a metadata object literal/],
    ["export const metadata = null;", /Expected a metadata object literal/],
    [preview({ title: "  " }), /Expected a non-empty title/],
    [
      preview({ description: "Now in messages" }),
      /Unknown metadata property "description"/,
    ],
    [
      preview({ icon: 'IconCheck } from "unsafe"' }),
      /Expected a Tabler icon export name/,
    ],
    [preview({ icon: null }), /Expected literal metadata values/],
    [preview({ order: "1" }), /Expected a finite order/],
    [preview({ order: null }), /Expected literal metadata values/],
    [
      preview().replace("satisfies ComponentMetadata", "satisfies"),
      /Cannot parse UI catalog metadata/,
    ],
    [
      preview().replace(
        '"icon":"IconCheck"',
        '"icon":"IconCheck","order":1e999',
      ),
      /Expected a finite order/,
    ],
    [
      "export function Preview() { return null; }",
      /Expected exactly one exported const metadata/,
    ],
    [
      `${preview()}\n${preview()}`,
      /Expected exactly one exported const metadata/,
    ],
    [
      preview().replace("export const metadata", "const metadata"),
      /Expected exported const metadata/,
    ],
    [
      preview().replace("export const metadata", "export let metadata"),
      /Expected exported const metadata/,
    ],
    [
      preview().replace('"title":"Example"', "title: externalTitle"),
      /Expected literal metadata values/,
    ],
    [
      preview().replace('"title":"Example"', "title: getTitle()"),
      /Expected literal metadata values/,
    ],
    [
      preview().replace('"title":"Example"', "title: `Hello ${externalTitle}`"),
      /Expected literal metadata values/,
    ],
    [
      preview().replace('"title":"Example"', '["title"]: "Example"'),
      /Expected non-computed metadata property assignments/,
    ],
    [
      preview().replace('"title":"Example"', "...shared"),
      /Expected non-computed metadata property assignments/,
    ],
    [
      preview().replace('"title":"Example"', "title"),
      /Expected non-computed metadata property assignments/,
    ],
    [
      preview().replace('"title":"Example"', 'title: "One", "title": "Two"'),
      /Duplicate metadata property/,
    ],
    [
      preview().replace(
        '"title":"Example"',
        'get title() { return "Example"; }',
      ),
      /Expected non-computed metadata property assignments/,
    ],
  ];
  for (const [source, expectedError] of invalidMetadata) {
    write(root, "checkbox", "preview.tsx", source);
    const generation = generateExampleIndexes(root);
    await expect(generation).rejects.toThrow(expectedError);
    await expect(generation).rejects.toThrow(
      componentPath(root, "checkbox", "preview.tsx"),
    );
    expect(
      generated.map((filename) => readFileSync(filename, "utf8")),
    ).toStrictEqual(previous);
  }
  write(root, "checkbox", "preview.tsx", preview());
  for (const filename of ["preview.tsx", "playground.tsx", "index.ts"]) {
    const path = componentPath(root, "checkbox", filename);
    const source = readFileSync(path, "utf8");
    rmSync(path);
    await expect(generateExampleIndexes(root)).rejects.toThrow(
      /Missing required UI catalog file/,
    );
    expect(
      generated.map((filename) => readFileSync(filename, "utf8")),
    ).toStrictEqual(previous);
    write(root, "checkbox", filename, source);
  }
});

test("删除、重命名示例和目录后不保留过期的引用", async () => {
  const root = fixture();
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

  expect((await readSources(root)).exampleFiles).toStrictEqual({
    checkbox: [{ id: "select-all", filename: "select-all.example.tsx" }],
  });
  const index = readFileSync(
    componentPath(root, "checkbox", "examples.generated.ts"),
    "utf8",
  );
  expect(index).not.toMatch(/basic|disabled/);
  expect(registrySource(root)).not.toMatch(/button/);
  expect(componentRegistrySource(root)).not.toMatch(/button/);
  expect((await readCatalog(root)).catalog.map(({ id }) => id)).toStrictEqual([
    "checkbox",
  ]);
});

test("相同输入不重写文件，源码变化只更新源码索引的内容摘要", async () => {
  const root = fixture();
  component(root, "checkbox");
  write(root, "checkbox", "basic.example.tsx", "export const value = 1;");
  write(root, "checkbox", "playground.tsx", "export const value = 1;");
  const generated = await generateExampleIndexes(root);
  const mtimes = generated.map((filename) => statSync(filename).mtimeMs);
  const initial = await readSources(root);

  expect(await generateExampleIndexes(root)).toStrictEqual([]);
  expect(generated.map((filename) => statSync(filename).mtimeMs)).toStrictEqual(
    mtimes,
  );
  for (const filename of ["basic.example.tsx", "playground.tsx"]) {
    const previous = await readSources(root);
    write(root, "checkbox", filename, "export const value = 2;");
    expect(await generateExampleIndexes(root)).toStrictEqual([
      sourceIndexPath(root),
    ]);
    const current = await readSources(root);
    expect(current.exampleSourceRevision).not.toBe(
      previous.exampleSourceRevision,
    );
    expect(current.exampleFiles).toStrictEqual(initial.exampleFiles);
  }
});

test("非法示例名称在写入索引前报错", async () => {
  const root = fixture();
  // 组件按 ID 排序处理，合法的 anchor 先通过校验，checkbox 才报错：边校验边写的话，anchor 的索引会留下来。
  component(root, "anchor");
  component(root, "checkbox");
  write(root, "checkbox", "Bad_name.example.tsx");
  await expect(generateExampleIndexes(root)).rejects.toThrow(
    /Expected a kebab-case UI catalog ID: Bad_name\.example\.tsx/,
  );
  expect(writtenIndexes(root, ["anchor", "checkbox"])).toStrictEqual([]);
});

test("LF 和 CRLF 源码生成相同摘要", async () => {
  const root = fixture();
  component(root, "checkbox");
  const content = "export const value = 1;\nexport const label = 'Example';\n";
  write(root, "checkbox", "basic.example.tsx", content);
  write(root, "checkbox", "playground.tsx", content);
  await generateExampleIndexes(root);
  const initial = await readSources(root);

  for (const filename of ["basic.example.tsx", "playground.tsx"]) {
    write(root, "checkbox", filename, content.replace(/\n/g, "\r\n"));
    expect(await generateExampleIndexes(root)).toStrictEqual([]);
    expect((await readSources(root)).exampleSourceRevision).toBe(
      initial.exampleSourceRevision,
    );
  }
});

test(
  "watch 自动处理文件和目录增删、重命名及源码内容修改",
  { timeout: 15_000 },
  async () => {
    const root = fixture();
    component(root, "anchor");
    const errors = [];
    const watcher = await watchExampleIndexes(root, {
      onError: (error) => errors.push(error),
    });
    onTestFinished(() => watcher.close());

    component(root, "checkbox");
    write(root, "checkbox", "basic.example.tsx", "export const value = 1;");
    write(root, "checkbox", "disabled.example.tsx");
    write(root, "checkbox", "select-all.example.tsx");
    await eventually(async () => {
      expect((await readSources(root)).exampleFiles.checkbox?.length).toBe(3);
      expect(
        (await readCatalog(root)).catalog.map(({ id }) => id),
      ).toStrictEqual(["anchor", "checkbox"]);
    });

    for (const filename of ["basic.example.tsx", "playground.tsx"]) {
      const previous = (await readSources(root)).exampleSourceRevision;
      write(root, "checkbox", filename, "export const value = 2;");
      await eventually(async () => {
        expect((await readSources(root)).exampleSourceRevision).not.toBe(
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
      expect((await readSources(root)).exampleFiles.checkbox).toStrictEqual([
        { id: "renamed", filename: "renamed.example.tsx" },
        { id: "select-all", filename: "select-all.example.tsx" },
      ]);
    });

    renameSync(componentPath(root, "checkbox"), componentPath(root, "button"));
    await eventually(async () => {
      const { exampleFiles } = await readSources(root);
      expect(Object.keys(exampleFiles)).toStrictEqual(["anchor", "button"]);
      expect(registrySource(root)).toMatch(/button-examples/);
      expect(registrySource(root)).not.toMatch(/checkbox-examples/);
      expect(componentRegistrySource(root)).toMatch(/button-examples/);
      expect(componentRegistrySource(root)).not.toMatch(/checkbox-examples/);
      expect(
        (await readCatalog(root)).catalog.map(({ id }) => id),
      ).toStrictEqual(["anchor", "button"]);
    });
    rmSync(componentPath(root, "button"), { recursive: true });
    await eventually(async () => {
      expect((await readSources(root)).exampleFiles).toStrictEqual({
        anchor: [],
      });
      expect(
        (await readCatalog(root)).catalog.map(({ id }) => id),
      ).toStrictEqual(["anchor"]);
    });
    expect(errors).toStrictEqual([]);
  },
);

test(
  "watch 校验 preview metadata 与必需文件，并在修正后恢复生成",
  { timeout: 15_000 },
  async () => {
    const root = fixture();
    component(root, "checkbox");
    const errors = [];
    const watcher = await watchExampleIndexes(root, {
      onError: (error) => errors.push(error),
    });
    onTestFinished(() => watcher.close());
    const initialCatalog = (await readCatalog(root)).catalog;

    write(root, "checkbox", "preview.tsx", "export const metadata = {");
    await eventually(() =>
      expect(errors.at(-1)?.message ?? "").toMatch(/Cannot parse/),
    );
    expect((await readCatalog(root)).catalog).toStrictEqual(initialCatalog);

    write(
      root,
      "checkbox",
      "preview.tsx",
      preview({ title: "Updated", icon: "IconPlus" }),
    );
    await eventually(async () => {
      expect((await readCatalog(root)).catalog[0].title).toBe("Updated");
      expect(componentRegistrySource(root)).toMatch(/IconPlus/);
    });

    for (const filename of ["preview.tsx", "playground.tsx", "index.ts"]) {
      const errorCount = errors.length;
      const path = componentPath(root, "checkbox", filename);
      const source = readFileSync(path, "utf8");
      rmSync(path);
      await eventually(() => {
        expect(errors.length).toBeGreaterThan(errorCount);
        expect(errors.at(-1).message).toMatch(
          /Missing required UI catalog file/,
        );
      });
      write(root, "checkbox", filename, source);
      write(root, "checkbox", "preview.tsx", preview({ title: filename }));
      await eventually(async () => {
        expect((await readCatalog(root)).catalog[0].title).toBe(filename);
      });
    }

    rmSync(componentPath(root, "checkbox"), { recursive: true });
    await eventually(() =>
      expect(errors.at(-1)?.message ?? "").toMatch(
        /Expected at least one UI catalog component directory/,
      ),
    );
    component(root, "button");
    await eventually(async () => {
      expect(
        (await readCatalog(root)).catalog.map(({ id }) => id),
      ).toStrictEqual(["button"]);
    });
  },
);

test(
  "watch 在示例目录里新建子目录、改子目录里的文件时都报错",
  { timeout: 15_000 },
  async () => {
    const root = fixture();
    component(root, "checkbox");
    const errors = [];
    const watcher = await watchExampleIndexes(root, {
      onError: (error) => errors.push(error),
    });
    onTestFinished(() => watcher.close());
    const nested = /Expected only files in a UI catalog examples directory/;

    mkdirSync(componentPath(root, "checkbox", "nested"));
    await eventually(() =>
      expect(errors.at(-1)?.message ?? "").toMatch(nested),
    );

    const errorCount = errors.length;
    write(root, "checkbox", "nested/deeper/basic.example.tsx");
    await eventually(() => {
      expect(errors.length).toBeGreaterThan(errorCount);
      expect(errors.at(-1).message).toMatch(nested);
    });
  },
);

test(
  "watch 首次生成失败时关闭监听并抛错，修好文件后也不再生成",
  { timeout: 15_000 },
  async () => {
    const failed = fixture();
    component(failed, "checkbox");
    write(failed, "checkbox", "preview.tsx", "export const metadata = {");
    const errors = [];
    await expect(
      watchExampleIndexes(failed, { onError: (error) => errors.push(error) }),
    ).rejects.toThrow(/Cannot parse UI catalog metadata/);

    // 对照：正常启动的 watcher 收到同样的修改会重新生成。两边防抖和生成的耗时相同，所以等对照组生成第二次：
    // 失败的一侧要是还在监听，第一次修改这时早已生成完。
    const control = fixture();
    component(control, "checkbox");
    const watcher = await watchExampleIndexes(control);
    onTestFinished(() => watcher.close());

    for (const title of ["Fixed", "Fixed again"]) {
      for (const root of [failed, control])
        write(root, "checkbox", "preview.tsx", preview({ title }));
      await eventually(async () => {
        expect((await readCatalog(control)).catalog[0].title).toBe(title);
      });
    }
    expect(existsSync(catalogPath(failed))).toBe(false);
    expect(errors).toStrictEqual([]);
  },
);
