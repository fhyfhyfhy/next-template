import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import createAppComponentPlacementRule from "./app-component-placement.mjs";
import componentExportsRule from "./component-exports.mjs";
import createFeatureConstantsRule from "./feature-constants.mjs";
import { featureDependencies } from "./feature-cycles.mjs";
import {
  createFeatureGraphLoader,
  FEATURE_GRAPH_FILE,
  parseFeatureGraph,
} from "./feature-graph.mjs";
import {
  appPath,
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
    // app/ 里只给部分路由用的组件放在 _components/（.claude/rules/architecture.md「Where files go」）。
    const componentsIndex = parts.findLastIndex(
      (part) => part === "components" || part === "_components",
    );
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

  const loadFeatureGraph = createFeatureGraphLoader(projectRoot);

  const featureDependenciesRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        missing:
          'Feature {{from}} depends on {{to}}, but the dependency graph in docs/features.md has no {{from}} --> {{to}} edge. Add the edge, labelled with what {{from}} uses {{to}} for, or remove the import. See "Feature boundaries" in .claude/rules/architecture.md.',
        graph: "Can't check this dependency between features: {{problem}}.",
      },
    },
    create(context) {
      const filename = context.filename;
      const sourceFeature = featurePath(projectRoot, filename)?.[0];
      if (!sourceFeature) return {};

      return importVisitors((source) => {
        const imported = projectImport(filename, source);
        if (!imported) return;
        const targetFeature = featurePath(projectRoot, imported.target)?.[0];
        if (!targetFeature || targetFeature === sourceFeature) return;

        const { graph, error } = loadFeatureGraph();
        if (error) {
          context.report({
            node: source,
            messageId: "graph",
            data: { problem: error },
          });
        } else if (!graph.get(sourceFeature)?.has(targetFeature)) {
          context.report({
            node: source,
            messageId: "missing",
            data: { from: sourceFeature, to: targetFeature },
          });
        }
      });
    },
  };

  // 检查 docs/features.md 本身：图里的节点和 features/ 下的目录一一对应，每条边在代码里都有依赖。
  // 代码里有、图里没有的依赖由 feature-dependencies 在 import 处报告。
  const featureGraphRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        unreadable: "The dependency graph can't be read: {{problem}}.",
        missingNode:
          "features/{{feature}} has no node in the dependency graph. Add it, with an edge to each feature it depends on.",
        missingDirectory:
          "Node {{feature}} has no directory under features/. Remove the node, or create the feature.",
        staleEdge:
          "No file in features/{{from}} depends on {{to}}. Remove the {{from}} --> {{to}} edge.",
      },
    },
    create(context) {
      // markdown 语言的行列都从 1 开始。
      const file = relative(projectRoot, context.filename).split(sep).join("/");
      if (file !== FEATURE_GRAPH_FILE) return {};

      return {
        root() {
          let parsed;
          try {
            parsed = parseFeatureGraph(context.sourceCode.text);
          } catch (error) {
            context.report({
              loc: { line: 1, column: 1 },
              messageId: "unreadable",
              data: { problem: error.message },
            });
            return;
          }
          const featuresDirectory = join(projectRoot, "features");
          const directories = existsSync(featuresDirectory)
            ? readdirSync(featuresDirectory, { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
            : [];
          const firstNodeLine = Math.min(...parsed.nodes.values(), Infinity);
          for (const feature of directories) {
            if (!parsed.nodes.has(feature)) {
              context.report({
                loc: {
                  line: Number.isFinite(firstNodeLine) ? firstNodeLine : 1,
                  column: 1,
                },
                messageId: "missingNode",
                data: { feature },
              });
            }
          }
          for (const [feature, line] of parsed.nodes) {
            if (!directories.includes(feature)) {
              context.report({
                loc: { line, column: 1 },
                messageId: "missingDirectory",
                data: { feature },
              });
            }
          }
          const actual = featureDependencies(projectRoot);
          for (const { from, to, line } of parsed.edges) {
            if (!actual.get(from)?.has(to)) {
              context.report({
                loc: { line, column: 1 },
                messageId: "staleEdge",
                data: { from, to },
              });
            }
          }
        },
      };
    },
  };

  const rootImportsRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        relative:
          "Use a relative path for project imports from the same directory or its subdirectories, and for imports within app/, ../ included.",
        alias:
          "Use @/ for project imports outside the current directory and its subdirectories, and from app/ to outside it.",
      },
    },
    create(context) {
      const filename = context.filename;
      if (featurePath(projectRoot, filename)) return {};
      const sourceComponent = componentDirectory(filename);
      // app/ 和一个 feature 一样算一个目录（architecture.md「Package imports」）：内部引用全用相对路径。
      const fromApp = appPath(projectRoot, filename) !== null;

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
        const wantsRelative = fromApp
          ? appPath(projectRoot, target) !== null
          : isNested;
        if (wantsRelative !== isRelative) {
          context.report({
            node: source,
            messageId: wantsRelative ? "relative" : "alias",
          });
        }
      });
    },
  };

  const reactQueryWrappers = new Set(
    SOURCE_EXTENSIONS.map((extension) =>
      resolve(projectRoot, `lib/react-query.${extension}`),
    ),
  );

  const isUiWrapper = (filename) =>
    relative(projectRoot, filename)
      .split(sep)
      .join("/")
      .startsWith("components/ui/");

  // 只能由封装文件引用的包。UI 库是 .claude/rules/libraries.md 里「used through their wrappers」那几个；
  // openSubpaths 是不渲染 UI 的工具，封装之外也能直接用。
  const wrappedPackages = [
    {
      name: "@tanstack/react-query",
      isWrapper: (filename) => reactQueryWrappers.has(filename),
      messageId: "wrapper",
    },
    ...["@base-ui/react", "sonner", "input-otp"].map((name) => ({
      name,
      isWrapper: isUiWrapper,
      messageId: "uiLibrary",
      openSubpaths:
        name === "@base-ui/react"
          ? [
              "merge-props",
              "use-render",
              "types",
              "csp-provider",
              "direction-provider",
            ]
          : [],
    })),
  ];

  const wrapperImportsRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        wrapper:
          "Import from @/lib/react-query. Only that wrapper may access the original package.",
        uiLibrary:
          "Use the project's wrapper of {{name}} from @/components/ui/. When it lacks the part you need, add that part to the wrapper. See .claude/rules/components.md.",
      },
    },
    create(context) {
      const restricted = wrappedPackages.filter(
        ({ isWrapper }) => !isWrapper(context.filename),
      );
      if (!restricted.length) return {};

      return importVisitors((source) => {
        const specifier = importSpecifier(source);
        if (!specifier) return;
        const wrapped = restricted.find(
          ({ name, openSubpaths = [] }) =>
            specifier === name ||
            (specifier.startsWith(`${name}/`) &&
              !openSubpaths.includes(specifier.slice(name.length + 1))),
        );
        if (wrapped) {
          context.report({
            node: source,
            messageId: wrapped.messageId,
            data: { name: wrapped.name },
          });
        }
      });
    },
  };

  return {
    rules: {
      "feature-imports": featureImportsRule,
      "feature-dependencies": featureDependenciesRule,
      "feature-graph": featureGraphRule,
      "feature-constants": createFeatureConstantsRule(projectRoot),
      "root-imports": rootImportsRule,
      "app-component-placement": createAppComponentPlacementRule(projectRoot),
      "no-feature-cycle": createFeatureCycleRule(projectRoot),
      "component-imports": componentImportsRule,
      "component-entry": componentEntryRule,
      "component-exports": componentExportsRule,
      "wrapper-imports": wrapperImportsRule,
    },
  };
}
