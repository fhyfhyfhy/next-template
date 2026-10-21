import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  watch,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import ts from "typescript";

const featurePath = "features/component-showcase";
const exampleSuffix = ".example.tsx";
const directorySuffix = "-examples";
const requiredFiles = ["demo.tsx", "playground.tsx", "index.ts"];
const generatedHeader =
  "// 此文件由 scripts/showcase/index-generator.mjs 自动生成，请勿手动修改。\n";
const kebabCase = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const iconName = /^Icon[A-Za-z0-9]+$/;
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function entries(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      compare(a.name, b.name),
    );
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function assertId(id, filename) {
  if (!kebabCase.test(id))
    throw new Error(`Expected a kebab-case showcase ID: ${filename}`);
}

function unwrapExpression(node) {
  while (
    node &&
    (ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node))
  ) {
    node = node.expression;
  }
  return node;
}

function metadataLiteral(node, filename) {
  const value = unwrapExpression(node);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    return value.text;
  if (ts.isNumericLiteral(value)) return Number(value.text);
  if (
    ts.isPrefixUnaryExpression(value) &&
    (value.operator === ts.SyntaxKind.PlusToken ||
      value.operator === ts.SyntaxKind.MinusToken)
  ) {
    const operand = unwrapExpression(value.operand);
    if (ts.isNumericLiteral(operand))
      return (
        Number(operand.text) *
        (value.operator === ts.SyntaxKind.MinusToken ? -1 : 1)
      );
  }
  throw new Error(`Expected literal metadata values in ${filename}`);
}

function readMetadata(directory) {
  const filename = join(directory, "demo.tsx");
  const source = ts.createSourceFile(
    filename,
    readFileSync(filename, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  if (source.parseDiagnostics.length) {
    const message = ts.flattenDiagnosticMessageText(
      source.parseDiagnostics[0].messageText,
      "\n",
    );
    throw new Error(
      `Cannot parse showcase metadata in ${filename}: ${message}`,
    );
  }
  const declarations = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? statement.declarationList.declarations
          .filter(
            ({ name }) => ts.isIdentifier(name) && name.text === "metadata",
          )
          .map((declaration) => ({ statement, declaration }))
      : [],
  );
  if (declarations.length !== 1)
    throw new Error(
      `Expected exactly one exported const metadata in ${filename}`,
    );
  const { statement, declaration } = declarations[0];
  if (
    !(statement.declarationList.flags & ts.NodeFlags.Const) ||
    !statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    )
  )
    throw new Error(`Expected exported const metadata in ${filename}`);
  const object = unwrapExpression(declaration.initializer);
  if (!object || !ts.isObjectLiteralExpression(object))
    throw new Error(`Expected a metadata object literal in ${filename}`);
  const metadata = {};
  for (const property of object.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))
    )
      throw new Error(
        `Expected non-computed metadata property assignments in ${filename}`,
      );
    const field = property.name.text;
    if (!["title", "description", "icon", "order"].includes(field))
      throw new Error(`Unknown metadata property "${field}" in ${filename}`);
    if (Object.hasOwn(metadata, field))
      throw new Error(`Duplicate metadata property "${field}" in ${filename}`);
    metadata[field] = metadataLiteral(property.initializer, filename);
  }
  for (const field of ["title", "description"]) {
    if (typeof metadata[field] !== "string" || !metadata[field].trim())
      throw new Error(`Expected a non-empty ${field} in ${filename}`);
  }
  if (typeof metadata.icon !== "string" || !iconName.test(metadata.icon))
    throw new Error(`Expected a Tabler icon export name in ${filename}`);
  if (metadata.order !== undefined && !Number.isFinite(metadata.order))
    throw new Error(`Expected a finite order in ${filename}`);
  return metadata;
}

function discoverExamples(projectRoot) {
  const componentsRoot = join(projectRoot, featurePath, "components");
  const sourceHash = createHash("sha256");
  const components = entries(componentsRoot)
    .filter(
      (entry) => entry.isDirectory() && entry.name.endsWith(directorySuffix),
    )
    .map((entry, index) => {
      const id = entry.name.slice(0, -directorySuffix.length);
      assertId(id, entry.name);
      const directory = join(componentsRoot, entry.name);
      const files = entries(directory).filter((file) => file.isFile());
      for (const filename of requiredFiles) {
        if (!files.some((file) => file.name === filename))
          throw new Error(
            `Missing required showcase file: ${join(directory, filename)}`,
          );
      }
      const metadata = readMetadata(directory);
      const examples = files
        .filter((file) => file.name.endsWith(exampleSuffix))
        .map((file) => {
          const exampleId = file.name.slice(0, -exampleSuffix.length);
          assertId(exampleId, file.name);
          return { id: exampleId, filename: file.name };
        });
      for (const filename of [
        "playground.tsx",
        ...examples.map((example) => example.filename),
      ]) {
        const sourcePath = join(directory, filename);
        if (existsSync(sourcePath)) {
          sourceHash
            .update(`${entry.name}/${filename}\0`)
            .update(readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n"))
            .update("\0");
        }
      }
      return {
        id,
        directory,
        directoryName: entry.name,
        binding: `component${index}Examples`,
        demoBinding: `Component${index}Demo`,
        metadata,
        examples,
      };
    });
  if (!components.length)
    throw new Error("Expected at least one showcase component directory");
  return { components, revision: sourceHash.digest("hex") };
}

function componentIndex(examples) {
  return `${generatedHeader}
"use client";

import type { ExampleDefinition } from "../../types/examples";
${examples
  .map(
    ({ filename }, index) =>
      `import { Example as Example${index}, metadata as metadata${index} } from "./${filename.slice(0, -4)}";`,
  )
  .join("\n")}

export const examples = [
${examples
  .map(
    ({ id, filename }, index) => `{
  ...metadata${index},
  id: ${JSON.stringify(id)},
  filename: ${JSON.stringify(filename)},
  component: Example${index},
},`,
  )
  .join("\n")}
] satisfies readonly ExampleDefinition[];
`;
}

function sourceIndex(components, revision) {
  const files = Object.fromEntries(
    components.map(({ id, examples }) => [id, examples]),
  );
  return `${generatedHeader}
// 源码内容变化也要更新此模块，让开发服务器重新读取展示和复制用的源码。
export const exampleSourceRevision = ${JSON.stringify(revision)};

export const exampleFiles = ${JSON.stringify(files)} as const;
`;
}

function exampleRegistry(components) {
  return `${generatedHeader}
"use client";

${components
  .map(
    ({ binding, directoryName }) =>
      `import { examples as ${binding} } from "../${directoryName}";`,
  )
  .join("\n")}

export const examplesByComponent = {
${components.map(({ id, binding }) => `${JSON.stringify(id)}: ${binding},`).join("\n")}
};
`;
}

function componentCatalog(components) {
  const catalog = [...components]
    .sort(
      (left, right) =>
        (left.metadata.order ?? 0) - (right.metadata.order ?? 0) ||
        compare(left.id, right.id),
    )
    .map(({ id, metadata: { title, description } }) => ({
      id,
      title,
      description,
    }));
  return `${generatedHeader}
export const catalog = ${JSON.stringify(catalog)} as const;
`;
}

function componentRegistry(components) {
  const icons = [
    ...new Set(components.map(({ metadata }) => metadata.icon)),
  ].sort(compare);
  return `${generatedHeader}
import { ${icons.join(", ")} } from "@tabler/icons-react";

${components
  .map(
    ({ demoBinding, directoryName }) =>
      `import { Demo as ${demoBinding} } from "./${directoryName}";`,
  )
  .join("\n")}

export const demosByComponent = {
${components.map(({ id, demoBinding }) => `${JSON.stringify(id)}: ${demoBinding},`).join("\n")}
};

export const iconsByComponent = {
${components.map(({ id, metadata }) => `${JSON.stringify(id)}: ${metadata.icon},`).join("\n")}
};
`;
}

/** 验证组件目录并生成目录、预览和源码索引；输入无效时保留已有生成物并抛错。 */
export async function generateExampleIndexes(projectRoot) {
  const root = resolve(projectRoot);
  const { components, revision } = discoverExamples(root);
  const outputs = [
    ...components.map(({ directory, examples }) => ({
      filename: join(directory, "examples.generated.ts"),
      source: componentIndex(examples),
    })),
    {
      filename: join(root, featurePath, "constants/example-files.generated.ts"),
      source: sourceIndex(components, revision),
    },
    {
      filename: join(
        root,
        featurePath,
        "components/example-list/registry.generated.ts",
      ),
      source: exampleRegistry(components),
    },
    {
      filename: join(root, featurePath, "constants/catalog.generated.ts"),
      source: componentCatalog(components),
    },
    {
      filename: join(
        root,
        featurePath,
        "components/component-registry.generated.ts",
      ),
      source: componentRegistry(components),
    },
  ];
  const formatted = await Promise.all(
    outputs.map(async (output) => ({
      ...output,
      source: await format(output.source, { parser: "typescript" }),
    })),
  );
  const changed = [];
  // 格式化期间目录可能被删除；停止整次写入，后续 watch 事件会用完整目录重试。
  for (const { directory } of components) {
    for (const filename of requiredFiles) {
      if (!existsSync(join(directory, filename)))
        throw new Error(
          `Showcase files changed during generation: ${directory}`,
        );
    }
  }
  for (const { filename, source } of formatted) {
    if (existsSync(filename) && readFileSync(filename, "utf8") === source)
      continue;
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename, source, "utf8");
    changed.push(filename);
  }
  return changed;
}

function isSourceEvent(filename) {
  if (!filename) return true;
  const parts = filename.toString().split(sep);
  if (!parts[0].endsWith(directorySuffix)) return false;
  return (
    parts.length === 1 ||
    (parts.length === 2 &&
      (parts[1].endsWith(exampleSuffix) || requiredFiles.includes(parts[1])))
  );
}

/**
 * 先监听再扫描，避免启动期间漏掉文件增删；后续生成串行执行。
 * 初次生成失败会关闭监听并抛错；后续失败交给 onError，修正文件后继续生成。
 */
export async function watchExampleIndexes(
  projectRoot,
  { onError = console.error } = {},
) {
  const root = resolve(projectRoot);
  let timer;
  let closed = false;
  let pending = Promise.resolve();
  const watcher = watch(
    join(root, featurePath, "components"),
    { recursive: true },
    (_event, filename) => {
      if (closed || !isSourceEvent(filename)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        pending = pending
          .then(() => {
            if (!closed) return generateExampleIndexes(root);
          })
          .catch(onError);
      }, 40);
    },
  );
  watcher.on("error", onError);
  pending = generateExampleIndexes(root);
  try {
    await pending;
  } catch (error) {
    closed = true;
    clearTimeout(timer);
    watcher.close();
    throw error;
  }
  return {
    async close() {
      closed = true;
      clearTimeout(timer);
      watcher.close();
      await pending;
    },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const projectRoot = resolve(import.meta.dirname, "../..");
  if (args.length === 0) {
    await generateExampleIndexes(projectRoot);
  } else if (args.length === 1 && args[0] === "--watch") {
    const watcher = await watchExampleIndexes(projectRoot);
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => {
        void watcher.close();
      });
    }
  } else {
    throw new Error(
      "Usage: node scripts/showcase/index-generator.mjs [--watch]",
    );
  }
}
