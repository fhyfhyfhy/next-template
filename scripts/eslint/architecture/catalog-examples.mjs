import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import {
  directorySuffix,
  examplesPath,
} from "../../ui-catalog/index-generator.mjs";
import { SOURCE_EXTENSIONS } from "../imports.mjs";

const COMPONENTS = "components/ui/";
const EXAMPLES = `${examplesPath}/`;

const sourceFile = new RegExp(`\\.(?:${SOURCE_EXTENSIONS.join("|")})$`);
const componentEntry = new RegExp(
  `^index\\.(?:${SOURCE_EXTENSIONS.join("|")})$`,
);
const isComponentFile = (name) =>
  sourceFile.test(name) && !/\.(?:test|spec)\./.test(name);
const isDirectory = (path) => existsSync(path) && statSync(path).isDirectory();

/** components/ui/ 下的单文件组件或组件目录的 index 入口所属组件的 ID；别的文件为 null。 */
function componentId(path) {
  if (!path.startsWith(COMPONENTS)) return null;
  const parts = path.slice(COMPONENTS.length).split("/");
  if (parts.length === 1 && isComponentFile(parts[0]))
    return parts[0].split(".")[0];
  if (parts.length === 2 && componentEntry.test(parts[1])) return parts[0];
  return null;
}

/** 示例目录的 index.ts 对应的组件 ID；别的文件为 null。 */
function examplesId(path) {
  if (!path.startsWith(EXAMPLES)) return null;
  const parts = path.slice(EXAMPLES.length).split("/");
  return parts.length === 2 &&
    parts[0].endsWith(directorySuffix) &&
    parts[1] === "index.ts"
    ? parts[0].slice(0, -directorySuffix.length)
    : null;
}

/**
 * components/ui/ 的每个组件都有 UI catalog 的示例目录，每个示例目录都对应一个组件（.claude/rules/ui-catalog.md）。
 * 组件 ID 是 components/ui/ 下的文件名去掉扩展名，或组件目录的名字。缺示例的组件报在它的文件或目录的 index 入口上，
 * 没有组件的示例目录报在它的 index.ts 上，各报一次。
 */
export default function createCatalogExamplesRule(projectRoot) {
  const hasExamples = (id) =>
    isDirectory(join(projectRoot, EXAMPLES, `${id}${directorySuffix}`));
  const hasComponent = (id) => {
    const directory = join(projectRoot, COMPONENTS);
    return (
      isDirectory(directory) &&
      readdirSync(directory, { withFileTypes: true }).some((entry) =>
        entry.isDirectory()
          ? entry.name === id
          : isComponentFile(entry.name) && entry.name.split(".")[0] === id,
      )
    );
  };

  return {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        missingExamples: `${COMPONENTS}{{id}} has no UI catalog examples. Add ${EXAMPLES}{{id}}${directorySuffix}/ in the same change, as .claude/rules/ui-catalog.md describes.`,
        missingComponent: `${EXAMPLES}{{id}}${directorySuffix}/ has no component to show: ${COMPONENTS} has no {{id}}. Name the directory after the component's ID, or remove it along with the component.`,
      },
    },
    create(context) {
      const path = relative(projectRoot, context.filename).split(sep).join("/");
      const component = componentId(path);
      const examples = examplesId(path);
      if (component === null && examples === null) return {};

      return {
        Program(node) {
          if (component !== null && !hasExamples(component)) {
            context.report({
              node,
              messageId: "missingExamples",
              data: { id: component },
            });
          } else if (examples !== null && !hasComponent(examples)) {
            context.report({
              node,
              messageId: "missingComponent",
              data: { id: examples },
            });
          }
        },
      };
    },
  };
}
