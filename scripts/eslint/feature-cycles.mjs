import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import ts from "typescript";

import {
  createProjectResolver,
  featurePath,
  SOURCE_EXTENSIONS,
} from "./imports.mjs";

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

function fileVersion(stat) {
  // ctime and the inode catch a write that restored mtime, and an editor's atomic replace.
  return stat
    ? `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`
    : null;
}

function sourceFiles(directory, cache, readStat) {
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

function moduleReferences(filename, text) {
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
 * Creates the feature cycle checker for the current file. filename is absolute, and sourceText may
 * be unsaved content. Returns the references in a cycle and the cycle's path, with lines and columns
 * from 1; other files are read from disk.
 */
export function createFeatureCycleChecker(projectRoot) {
  const root = resolve(projectRoot);
  const cache = new Map();
  const directories = new Map();
  let snapshot;
  let resolveImport;
  let resolutionRevision = 0;
  let resolverDependencies = new Map();
  let graph = new Map();

  function readStat(filename) {
    const path = resolve(filename);
    if (!snapshot.has(path))
      snapshot.set(path, statSync(path, { throwIfNoEntry: false }));
    return snapshot.get(path);
  }

  function resolverStat(filename) {
    const stat = readStat(filename);
    resolverDependencies.set(resolve(filename), fileVersion(stat));
    return stat;
  }

  function refreshResolver() {
    if (
      resolveImport &&
      [...resolverDependencies].every(
        ([filename, version]) => fileVersion(readStat(filename)) === version,
      )
    )
      return;

    resolveImport = undefined;
    resolverDependencies = new Map();
    // Tracks extends, package.json and the missing paths probed while resolving too, so that a new
    // target also invalidates the cache.
    resolveImport = createProjectResolver(root, {
      ...ts.sys,
      fileExists: (filename) => resolverStat(filename)?.isFile() ?? false,
      directoryExists: (directory) =>
        resolverStat(directory)?.isDirectory() ?? false,
      readFile: (filename) => {
        resolverStat(filename);
        return ts.sys.readFile(filename);
      },
      realpath: (filename) => {
        resolverStat(filename);
        return ts.sys.realpath(filename);
      },
    });
    resolutionRevision++;
  }

  return (filename, sourceText) => {
    const parts = featurePath(root, filename);
    if (!parts || parts.length < 2) return [];
    const previous = cache.get(filename);
    const references =
      previous?.text === sourceText
        ? previous.references
        : moduleReferences(filename, sourceText);
    if (!references.length) return [];

    snapshot = new Map();
    refreshResolver();
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

    // The search back stops at the current feature, so its old outgoing edges do not affect the result.
    // Only the references in the text passed in are searched back from, so unsaved content need not
    // go into the shared graph of what is on disk.
    const paths = new Map();
    return current.flatMap(({ from, to, ...reference }) => {
      if (!paths.has(to)) paths.set(to, findPath(graph, to, from));
      const path = paths.get(to);
      return path ? [{ ...reference, cycle: [from, ...path] }] : [];
    });
  };
}
