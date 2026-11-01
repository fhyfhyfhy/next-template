import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import componentExportsRule from "./component-exports.mjs";
import {
  createProjectResolver,
  featurePath,
  SOURCE_EXTENSIONS,
} from "./imports.mjs";
import createFeatureCycleRule from "./no-feature-cycle.mjs";

const componentEntryPattern = new RegExp(
  `^index\\.(?:d\\.)?(?:${SOURCE_EXTENSIONS.join("|")})$`,
);
const componentSourceEntryPattern = new RegExp(
  `^index\\.(?:${SOURCE_EXTENSIONS.join("|")})$`,
);

/**
 * 将层级声明转换为 import/no-restricted-paths 的禁止依赖区域。
 * except 不按 basePath 解析，所以全部用 glob 表达。
 */
export function layerZones(layers, section) {
  return layers.slice(1).map((layer, index) => {
    const forbidden = layers.slice(0, index + 1);
    const allowed = layers.slice(index + 1);
    const rule = `${layer.name} can import its own layer and lower layers: ${allowed.map((other) => other.name).join(", ")}. Circular dependencies are forbidden.`;
    return {
      target: layer.files,
      from: forbidden.flatMap((other) => other.files),
      message: `${rule} Extract a lower-layer dependency within its owner, or move composition to the caller. Keep business code in its feature. See "${section}" and "Shared code ownership" in .claude/rules/architecture.md.`,
    };
  });
}

/** 为调用方的项目根目录创建架构插件，解析器与循环检查状态在该实例内共享。 */
export default function createArchitecturePlugin(projectRoot) {
  const resolveProjectImport = createProjectResolver(projectRoot);

  function importSpecifier(source) {
    if (!source) return null;
    const specifier =
      source.type === "TemplateLiteral" && source.expressions.length === 0
        ? source.quasis[0].value.cooked
        : source.value;
    return typeof specifier === "string" ? specifier : null;
  }

  function projectImport(filename, source) {
    return resolveProjectImport(filename, importSpecifier(source));
  }

  function importVisitors(check) {
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      TSImportType: (node) => check(node.source),
      TSExternalModuleReference: (node) => check(node.expression),
      CallExpression: (node) => {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments.length === 1
        ) {
          check(node.arguments[0]);
        }
      },
    };
  }

  function componentDirectory(filename) {
    const parts = relative(projectRoot, filename).split(sep);
    const componentsIndex = parts.lastIndexOf("components");
    if (parts[0] === ".." || componentsIndex === -1) return null;
    // ui/ 是组件集合；components/ui/dialog/ 才是独立组件目录。
    const componentIndex =
      componentsIndex + (parts[componentsIndex + 1] === "ui" ? 2 : 1);
    if (parts.length <= componentIndex + 1) return null;
    return resolve(projectRoot, ...parts.slice(0, componentIndex + 1));
  }

  const componentImportsRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        private:
          "Import through the public index entry of {{directory}}. Only files inside that component directory can directly access its implementation files.",
        relative:
          "Use a relative path between files inside the same component directory.",
      },
    },
    create(context) {
      const filename = context.filename;
      const sourceDirectory = componentDirectory(filename);

      return importVisitors((source) => {
        const imported = projectImport(filename, source);
        if (!imported) return;
        const targetDirectory = componentDirectory(imported.target);
        if (!targetDirectory) return;
        if (targetDirectory === sourceDirectory) {
          // feature-imports 已负责 feature 内的相对路径约定。
          if (!imported.isRelative && !featurePath(projectRoot, filename)) {
            context.report({ node: source, messageId: "relative" });
          }
          return;
        }
        if (
          componentEntryPattern.test(relative(targetDirectory, imported.target))
        )
          return;

        context.report({
          node: source,
          messageId: "private",
          data: {
            directory: relative(projectRoot, targetDirectory)
              .split(sep)
              .join("/"),
          },
        });
      });
    },
  };

  const componentEntryRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        multiple:
          "Keep one component implementation entry in {{directory}}. Found: {{entries}}. Type declarations may accompany that entry.",
      },
    },
    create(context) {
      const directory = componentDirectory(context.filename);
      if (
        !directory ||
        !componentSourceEntryPattern.test(relative(directory, context.filename))
      )
        return {};

      return {
        Program(node) {
          const entries = SOURCE_EXTENSIONS.map(
            (extension) => `index.${extension}`,
          ).filter((entry) => {
            const filename = resolve(directory, entry);
            return existsSync(filename) && statSync(filename).isFile();
          });
          if (entries.length > 1) {
            context.report({
              node,
              messageId: "multiple",
              data: {
                directory: relative(projectRoot, directory)
                  .split(sep)
                  .join("/"),
                entries: entries.sort().join(", "),
              },
            });
          }
        },
      };
    },
  };

  const featureImportsRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        relative:
          "Use a relative path within the same feature, including imports across its subdirectories.",
        alias: "Use @/ for project imports that cross a feature boundary.",
        entry:
          "Import from the feature's entry (@/features/{name} or a root sub-entry like @/features/{name}/canvas). Internal files and directories are private.",
        selfEntry:
          "Feature implementations must import their dependencies directly, using relative paths, instead of importing their own feature's public entries. Component entries remain allowed.",
      },
    },
    create(context) {
      const filename = context.filename;
      const sourceParts = featurePath(projectRoot, filename);
      const sourceFeature = sourceParts?.[0];

      function check(source) {
        const imported = projectImport(filename, source);
        if (!imported) return;
        const { target, isRelative, isAlias } = imported;
        const targetParts = featurePath(projectRoot, target);
        const targetFeature = targetParts?.[0];

        if (sourceFeature && sourceFeature === targetFeature) {
          if (sourceParts.length > 2 && targetParts.length <= 2) {
            context.report({ node: source, messageId: "selfEntry" });
          } else if (!isRelative) {
            context.report({ node: source, messageId: "relative" });
          }
          return;
        }

        if ((sourceFeature || targetFeature) && !isAlias) {
          context.report({ node: source, messageId: "alias" });
        }

        if (
          targetParts &&
          (targetParts.length > 2 ||
            (targetParts.length === 2 &&
              existsSync(target) &&
              statSync(target).isDirectory()))
        ) {
          context.report({ node: source, messageId: "entry" });
        }
      }

      return importVisitors(check);
    },
  };

  const rootImportsRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        relative:
          "Use a relative path (./) for project imports from the same directory or its subdirectories.",
        alias:
          "Use @/ for project imports outside the current directory and its subdirectories.",
      },
    },
    create(context) {
      const filename = context.filename;
      if (featurePath(projectRoot, filename)) return {};
      const sourceComponent = componentDirectory(filename);

      return importVisitors((source) => {
        const imported = projectImport(filename, source);
        if (!imported) return;
        const { target, isRelative } = imported;
        // feature 由 feature-imports 检查，同一组件目录由 component-imports 检查，node_modules 由 import/no-relative-packages 检查。
        if (
          featurePath(projectRoot, target) ||
          (sourceComponent && componentDirectory(target) === sourceComponent) ||
          relative(projectRoot, target).split(sep).includes("node_modules")
        )
          return;
        const fromDirectory = relative(dirname(filename), target);
        const isNested =
          !isAbsolute(fromDirectory) && fromDirectory.split(sep)[0] !== "..";
        if (isNested !== isRelative) {
          context.report({
            node: source,
            messageId: isNested ? "relative" : "alias",
          });
        }
      });
    },
  };

  const packageImportsRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        unsupported:
          "Only #credentials is supported as a package import. Use @/ or relative paths for other project modules.",
        owner:
          "Only lib/fetch/index.ts may import #credentials. Backend consumers use fetchApi from @/lib/fetch.",
        mapping:
          'Keep package.json imports["#credentials"] as { "react-server": "./lib/fetch/credentials-server.ts", "default": "./lib/fetch/credentials-browser.ts" }, in that order. Other conditional targets are not covered by the architecture checks.',
      },
    },
    create(context) {
      return importVisitors((source) => {
        const specifier = importSpecifier(source);
        if (!specifier?.startsWith("#")) return;
        if (specifier !== "#credentials") {
          context.report({ node: source, messageId: "unsupported" });
          return;
        }
        if (context.filename !== resolve(projectRoot, "lib/fetch/index.ts")) {
          context.report({ node: source, messageId: "owner" });
          return;
        }

        const manifest = JSON.parse(
          readFileSync(resolve(projectRoot, "package.json"), "utf8"),
        );
        // 条件按键顺序匹配：default 放在前面会吞掉 react-server；额外分支也可能绕过架构检查。
        if (
          JSON.stringify(manifest.imports?.["#credentials"]) !==
          JSON.stringify({
            "react-server": "./lib/fetch/credentials-server.ts",
            default: "./lib/fetch/credentials-browser.ts",
          })
        ) {
          context.report({ node: source, messageId: "mapping" });
        }
      });
    },
  };

  const reactQueryWrappers = new Set(
    SOURCE_EXTENSIONS.map((extension) =>
      resolve(projectRoot, `lib/react-query.${extension}`),
    ),
  );

  const wrapperImportsRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        wrapper:
          "Import from @/lib/react-query. Only that wrapper may access the original package.",
      },
    },
    create(context) {
      if (reactQueryWrappers.has(context.filename)) return {};

      return importVisitors((source) => {
        const specifier = importSpecifier(source);
        if (
          specifier === "@tanstack/react-query" ||
          specifier?.startsWith("@tanstack/react-query/")
        ) {
          context.report({ node: source, messageId: "wrapper" });
        }
      });
    },
  };

  return {
    rules: {
      "feature-imports": featureImportsRule,
      "root-imports": rootImportsRule,
      "no-feature-cycle": createFeatureCycleRule(projectRoot),
      "component-imports": componentImportsRule,
      "component-entry": componentEntryRule,
      "component-exports": componentExportsRule,
      "package-imports": packageImportsRule,
      "wrapper-imports": wrapperImportsRule,
    },
  };
}
