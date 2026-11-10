import { readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

import { fileVersion } from "../file-versions.mjs";
import { createProjectResolver } from "../imports.mjs";
import { moduleReferences, sourceFiles } from "./feature-cycles.mjs";

const COMPONENTS = "_components";
// 测试跟着它测的模块走，不算使用方：否则旁边的测试会把模块钉在原地。
const testFile = /\.(?:test|spec)\.[^.]+$|-test-helpers\.[^.]+$/;
const SEE = 'See "Where files go" in .claude/rules/architecture.md.';

function partsOf(root, filename) {
  return relative(root, filename).split(sep);
}

function within(inner, outer) {
  return (
    outer.length <= inner.length &&
    outer.every((part, index) => inner[index] === part)
  );
}

function commonAncestor(directories) {
  return directories.reduce((common, directory) => {
    let length = 0;
    while (
      length < common.length &&
      length < directory.length &&
      common[length] === directory[length]
    )
      length++;
    return common.slice(0, length);
  });
}

/** 文件所在的路由目录：_components/ 里的文件算它所在的那一层。 */
function homeOf(parts) {
  const directory = parts.slice(0, -1);
  const index = directory.indexOf(COMPONENTS);
  return index === -1 ? directory : directory.slice(0, index);
}

/**
 * app/ 下 _components/ 里的模块：owner 是 _components/ 所在的目录；组件目录（_components/<dir>/）整体
 * 是一个单元，经它的 index 引用，平铺的文件自成一个单元。
 */
function componentModule(parts) {
  if (parts[0] !== "app") return null;
  const index = parts.indexOf(COMPONENTS);
  if (index === -1 || index === parts.length - 1) return null;
  const flat = parts.length === index + 2;
  return {
    owner: parts.slice(0, index),
    unit: flat ? parts : parts.slice(0, index + 2),
    isEntry:
      flat ||
      (parts.length === index + 3 &&
        basename(parts.at(-1)).startsWith("index.")),
  };
}

/** 按磁盘内容索引 app/ 里每个文件引用到的目标；文件都没变时复用上次的索引。 */
function createImporterIndex(root) {
  const resolveImport = createProjectResolver(root);
  const directories = new Map();
  const references = new Map();
  let lastKey;
  let lastIndex;
  return () => {
    const readStat = (path) => statSync(path, { throwIfNoEntry: false });
    const files = sourceFiles(join(root, "app"), directories, readStat);
    const versions = files.map((file) => fileVersion(readStat(file)));
    const key = files
      .map((file, index) => `${file}\0${versions[index]}`)
      .join("\n");
    if (key === lastKey) return lastIndex;
    for (const file of references.keys())
      if (!files.includes(file)) references.delete(file);
    const index = new Map();
    files.forEach((file, position) => {
      let cached = references.get(file);
      if (cached?.version !== versions[position]) {
        cached = {
          version: versions[position],
          specifiers: moduleReferences(file, readFileSync(file, "utf8")).map(
            (reference) => reference.specifier,
          ),
        };
        references.set(file, cached);
      }
      for (const specifier of cached.specifiers) {
        const target = resolveImport(file, specifier)?.target;
        if (!target) continue;
        if (!index.has(target)) index.set(target, new Set());
        index.get(target).add(file);
      }
    });
    lastKey = key;
    lastIndex = index;
    return index;
  };
}

/**
 * app/ 里 _components/ 的位置：它在所有使用方所在目录的最近公共祖先里。比它高的文件引用它，报
 * above，该往上挪；使用方都在更深的同一个目录里，报 deeper，该往下挪。
 */
export default function createAppComponentPlacementRule(projectRoot) {
  const root = resolve(projectRoot);
  const resolveImport = createProjectResolver(root);
  const importers = createImporterIndex(root);

  function usersOf(unit) {
    const unitPath = resolve(root, ...unit);
    const inUnit = (file) =>
      file === unitPath || file.startsWith(unitPath + sep);
    const users = new Set();
    for (const [target, files] of importers()) {
      if (!inUnit(target)) continue;
      for (const file of files)
        if (!inUnit(file) && !testFile.test(basename(file))) users.add(file);
    }
    return [...users];
  }

  return {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        above: `{{owner}}/_components/ serves the routes in {{owner}}/ and below, and this file sits above them. Move the module up to {{target}}/_components/, the deepest directory holding every file that uses it. ${SEE}`,
        deeper: `Every file using this module sits in {{target}}/. Move it down to {{target}}/_components/, the deepest directory holding all of them. ${SEE}`,
      },
    },
    create(context) {
      const filename = context.filename;
      const parts = partsOf(root, filename);
      if (parts[0] !== "app") return {};
      const home = homeOf(parts);
      const own = componentModule(parts);

      return {
        Program(node) {
          for (const reference of moduleReferences(
            filename,
            context.sourceCode.text,
          )) {
            const target = resolveImport(filename, reference.specifier)?.target;
            const targetModule =
              target && componentModule(partsOf(root, target));
            if (!targetModule || within(home, targetModule.owner)) continue;
            context.report({
              loc: {
                start: { line: reference.line, column: reference.column - 1 },
                end: {
                  line: reference.endLine,
                  column: reference.endColumn - 1,
                },
              },
              messageId: "above",
              data: {
                owner: targetModule.owner.join("/"),
                target: commonAncestor([home, targetModule.owner]).join("/"),
              },
            });
          }

          if (!own?.isEntry) return;
          const users = usersOf(own.unit).map((file) =>
            homeOf(partsOf(root, file)),
          );
          if (!users.length) return;
          const deepest = commonAncestor(users);
          if (deepest.length > own.owner.length && within(deepest, own.owner))
            context.report({
              node,
              messageId: "deeper",
              data: { target: deepest.join("/") },
            });
        },
      };
    },
  };
}
