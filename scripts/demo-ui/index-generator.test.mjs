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

const featurePath = "features/demo-ui";
let moduleVersion = 0;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "demo-ui-indexes-"));
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

test("discovers zero, one and three examples, ignoring helper files and nested directories", async () => {
  const root = fixture();
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
  expect(checkboxIndex).not.toMatch(/playground|helper|ignored|folder/);
  expect(registrySource(root)).toMatch(/from "\.\.\/empty-examples";/);
  expect(registrySource(root)).not.toMatch(/examples\.generated/);
});

test("throws a clear error when there is no component directory, instead of generating an unusable empty catalog", async () => {
  const root = fixture();
  await expect(generateExampleIndexes(root)).rejects.toThrow(
    /Expected at least one UI demo component directory/,
  );
  expect(existsSync(sourceIndexPath(root))).toBe(false);
});

test("component directories sort by order and id, and Demo and the deduplicated icons use static public imports", async () => {
  const root = fixture();
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
  expect(catalog.map(({ id }) => id)).toStrictEqual([
    "first",
    "alpha",
    "beta",
    "zebra",
  ]);
  expect(catalog.at(-1)).toStrictEqual({
    id: "zebra",
    title: "Last",
    description: "Last component",
  });
  const registry = componentRegistrySource(root);
  expect(registry).toMatch(
    /import \{ IconCheck, IconZoom \} from "@tabler\/icons-react";/,
  );
  expect(registry).toMatch(
    /import \{ Demo as \w+ \} from "\.\/alpha-examples";/,
  );
  expect(registry).toMatch(/export const demosByComponent =/);
  expect(registry).toMatch(/export const iconsByComponent =/);
  expect(registry).not.toMatch(/use client|\/demo"/);
});

test("reads literals with comments and type wrappers statically, without running the TSX or loading its dependencies", async () => {
  const root = fixture();
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
  // metadata always comes from this file's literals.
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
  expect((await readCatalog(root)).catalog).toStrictEqual([
    { id: "wrapped", title: "Wrapped", description: "Template description" },
    { id: "plain", title: "Plain", description: "Plain description" },
  ]);
});

test("invalid metadata or a missing required file keeps every old generated file", async () => {
  const root = fixture();
  component(root, "button");
  component(root, "checkbox");
  const generated = await generateExampleIndexes(root);
  const previous = generated.map((filename) => readFileSync(filename, "utf8"));
  write(root, "button", "demo.tsx", demo({ title: "New" }));
  const invalidMetadata = [
    ["export const metadata = {", /Cannot parse UI demo metadata/],
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
      /Cannot parse UI demo metadata/,
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
    const generation = generateExampleIndexes(root);
    await expect(generation).rejects.toThrow(expectedError);
    await expect(generation).rejects.toThrow(
      componentPath(root, "checkbox", "demo.tsx"),
    );
    expect(
      generated.map((filename) => readFileSync(filename, "utf8")),
    ).toStrictEqual(previous);
  }
  write(root, "checkbox", "demo.tsx", demo());
  for (const filename of ["demo.tsx", "playground.tsx", "index.ts"]) {
    const path = componentPath(root, "checkbox", filename);
    const source = readFileSync(path, "utf8");
    rmSync(path);
    await expect(generateExampleIndexes(root)).rejects.toThrow(
      /Missing required UI demo file/,
    );
    expect(
      generated.map((filename) => readFileSync(filename, "utf8")),
    ).toStrictEqual(previous);
    write(root, "checkbox", filename, source);
  }
});

test("deleting or renaming examples and directories leaves no stale references", async () => {
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

test("the same input rewrites no file, and a source change updates only the source index's content digest", async () => {
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

test("an invalid example name throws before the indexes are written", async () => {
  const root = fixture();
  component(root, "checkbox");
  write(root, "checkbox", "Bad_name.example.tsx");
  await expect(generateExampleIndexes(root)).rejects.toThrow(
    /Expected a kebab-case UI demo ID: Bad_name\.example\.tsx/,
  );
});

test("LF and CRLF sources produce the same digest", async () => {
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

test("watch handles files and directories being added, removed and renamed, and source content changes", async () => {
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
    expect((await readCatalog(root)).catalog.map(({ id }) => id)).toStrictEqual(
      ["anchor", "checkbox"],
    );
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
    expect((await readCatalog(root)).catalog.map(({ id }) => id)).toStrictEqual(
      ["anchor", "button"],
    );
  });
  rmSync(componentPath(root, "button"), { recursive: true });
  await eventually(async () => {
    expect((await readSources(root)).exampleFiles).toStrictEqual({
      anchor: [],
    });
    expect((await readCatalog(root)).catalog.map(({ id }) => id)).toStrictEqual(
      ["anchor"],
    );
  });
  expect(errors).toStrictEqual([]);
});

test("watch validates demo metadata and required files, and resumes generating once they are fixed", async () => {
  const root = fixture();
  component(root, "checkbox");
  const errors = [];
  const watcher = await watchExampleIndexes(root, {
    onError: (error) => errors.push(error),
  });
  onTestFinished(() => watcher.close());
  const initialCatalog = (await readCatalog(root)).catalog;

  write(root, "checkbox", "demo.tsx", "export const metadata = {");
  await eventually(() =>
    expect(errors.at(-1)?.message ?? "").toMatch(/Cannot parse/),
  );
  expect((await readCatalog(root)).catalog).toStrictEqual(initialCatalog);

  write(
    root,
    "checkbox",
    "demo.tsx",
    demo({ title: "Updated", icon: "IconPlus" }),
  );
  await eventually(async () => {
    expect((await readCatalog(root)).catalog[0].title).toBe("Updated");
    expect(componentRegistrySource(root)).toMatch(/IconPlus/);
  });

  for (const filename of ["demo.tsx", "playground.tsx", "index.ts"]) {
    const errorCount = errors.length;
    const path = componentPath(root, "checkbox", filename);
    const source = readFileSync(path, "utf8");
    rmSync(path);
    await eventually(() => {
      expect(errors.length).toBeGreaterThan(errorCount);
      expect(errors.at(-1).message).toMatch(/Missing required UI demo file/);
    });
    write(root, "checkbox", filename, source);
    write(root, "checkbox", "demo.tsx", demo({ title: filename }));
    await eventually(async () => {
      expect((await readCatalog(root)).catalog[0].title).toBe(filename);
    });
  }

  rmSync(componentPath(root, "checkbox"), { recursive: true });
  await eventually(() =>
    expect(errors.at(-1)?.message ?? "").toMatch(
      /Expected at least one UI demo component directory/,
    ),
  );
  component(root, "button");
  await eventually(async () => {
    expect((await readCatalog(root)).catalog.map(({ id }) => id)).toStrictEqual(
      ["button"],
    );
  });
});
