import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import ts from "typescript";

import {
  createCachedResolver,
  createStatSnapshot,
  fileVersion,
} from "../file-versions.mjs";
import {
  createProjectResolver,
  featurePath,
  SOURCE_EXTENSIONS,
} from "../imports.mjs";

const ignoredDirectories = new Set([
  "node_modules",
  ".git",
  ".next",
  "out",
  "build",
  "coverage",
]);
const sourceExtensions = new Set(
  SOURCE_EXTENSIONS.map((extension) => `.${extension}`),
);
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

export function sourceFiles(directory, cache, readStat) {
  const files = [];
  const visited = new Set();
  function visit(current) {
    const stat = readStat(current);
    if (!stat?.isDirectory()) return;
    visited.add(current);
    const version = fileVersion(stat);
    let cached = cache.get(current);
    if (cached?.version !== version) {
      cached = {
        version,
        entries: readdirSync(current, { withFileTypes: true }).sort((a, b) =>
          compare(a.name, b.name),
        ),
      };
      cache.set(current, cached);
    }
    for (const entry of cached.entries) {
      const filename = join(current, entry.name);
      if (entry.isDirectory() && !ignoredDirectories.has(entry.name))
        visit(filename);
      else if (entry.isFile() && sourceExtensions.has(extname(entry.name)))
        files.push(filename);
    }
  }
  visit(directory);
  for (const cached of cache.keys())
    if (!visited.has(cached)) cache.delete(cached);
  return files;
}

export function moduleReferences(filename, text) {
  const sourceFile = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const references = [];
  function add(node) {
    if (
      node &&
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ) {
      const start = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      references.push({
        specifier: node.text,
        line: start.line + 1,
        column: start.character + 1,
        endLine: end.line + 1,
        endColumn: end.character + 1,
      });
    }
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      add(node.moduleSpecifier);
    else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument)
    ) {
      add(node.argument.literal);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return references;
}

function crossFeatureReferences(root, filename, references, resolveImport) {
  const parts = featurePath(root, filename);
  if (!parts || parts.length < 2) return [];
  return references.flatMap((reference) => {
    const imported = resolveImport(filename, reference.specifier);
    const target = imported && featurePath(root, imported.target);
    return target && target.length >= 2 && target[0] !== parts[0]
      ? [{ from: parts[0], to: target[0], ...reference }]
      : [];
  });
}

function findPath(graph, start, end) {
  const queue = [start];
  const parents = new Map([[start, null]]);
  for (let index = 0; index < queue.length; index++) {
    const feature = queue[index];
    if (feature === end) {
      const path = [];
      for (let member = end; member !== null; member = parents.get(member))
        path.push(member);
      return path.reverse();
    }
    for (const target of [...(graph.get(feature) ?? [])].sort(compare)) {
      if (parents.has(target)) continue;
      parents.set(target, feature);
      queue.push(target);
    }
  }
  return null;
}

/**
 * 按磁盘内容读出 features/ 下每个 feature 实际依赖的 feature（含类型引用），供依赖图检查和代码对照。
 * 每次调用重新扫描，不缓存：只在 lint docs/features.md 时调用一次。
 */
export function featureDependencies(projectRoot) {
  const root = resolve(projectRoot);
  const resolveImport = createProjectResolver(root);
  const readStat = (path) => statSync(path, { throwIfNoEntry: false });
  const graph = new Map();
  for (const file of sourceFiles(join(root, "features"), new Map(), readStat)) {
    const references = moduleReferences(file, readFileSync(file, "utf8"));
    for (const { from, to } of crossFeatureReferences(
      root,
      file,
      references,
      resolveImport,
    )) {
      if (!graph.has(from)) graph.set(from, new Set());
      graph.get(from).add(to);
    }
  }
  return graph;
}

/**
 * 为 projectRoot 的项目创建 feature 循环检查器。每个项目创建一个，跨文件复用：它缓存读过的文件和解析结果。
 * 返回的检查器一次检查一个文件：filename 使用绝对路径，sourceText 可为未保存内容。它返回参与循环的引用及
 * 循环路径，行列从 1 开始；其他文件以磁盘内容为准。
 */
export function createFeatureCycleChecker(projectRoot) {
  const root = resolve(projectRoot);
  const cache = new Map();
  const directories = new Map();
  const stats = createStatSnapshot();
  const { readStat } = stats;
  const currentResolver = createCachedResolver(root, readStat);
  let graph = new Map();

  return (filename, sourceText) => {
    const parts = featurePath(root, filename);
    if (!parts || parts.length < 2) return [];
    const previous = cache.get(filename);
    const references =
      previous?.text === sourceText
        ? previous.references
        : moduleReferences(filename, sourceText);
    if (!references.length) return [];

    stats.reset();
    const { resolveImport, revision: resolutionRevision } = currentResolver();
    const current =
      previous?.resolutionRevision === resolutionRevision &&
      previous.text === sourceText
        ? previous.edges
        : crossFeatureReferences(root, filename, references, resolveImport);
    if (!current.length) return [];

    const files = new Set(
      sourceFiles(join(root, "features"), directories, readStat),
    );
    let graphChanged = false;
    for (const cached of cache.keys()) {
      if (!files.has(cached)) {
        cache.delete(cached);
        graphChanged = true;
      }
    }
    for (const file of files) {
      const version = fileVersion(readStat(file));
      let cached = cache.get(file);
      let changed = false;
      if (cached?.version !== version) {
        const text = readFileSync(file, "utf8");
        if (cached?.text !== text) {
          cached = {
            text,
            references:
              file === filename && text === sourceText
                ? references
                : moduleReferences(file, text),
          };
          cache.set(file, cached);
          changed = true;
        }
        cached.version = version;
      }
      if (changed || cached.resolutionRevision !== resolutionRevision) {
        cached.edges = crossFeatureReferences(
          root,
          file,
          cached.references,
          resolveImport,
        );
        cached.resolutionRevision = resolutionRevision;
        graphChanged = true;
      }
    }
    if (graphChanged) {
      graph = new Map();
      for (const { edges } of cache.values()) {
        for (const { from, to } of edges) {
          if (!graph.has(from)) graph.set(from, new Set());
          graph.get(from).add(to);
        }
      }
    }

    // 回程搜索到达当前 feature 就停止，其旧出边不影响结果。
    // 只对传入文本的引用查回程，未保存内容无需写入共享磁盘图。
    const paths = new Map();
    return current.flatMap(({ from, to, ...reference }) => {
      if (!paths.has(to)) paths.set(to, findPath(graph, to, from));
      const path = paths.get(to);
      return path ? [{ ...reference, cycle: [from, ...path] }] : [];
    });
  };
}
