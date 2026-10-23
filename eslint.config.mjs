import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";

import componentExportsRule from "./scripts/architecture/component-exports.mjs";
import {
  createProjectResolver,
  featurePath,
  SOURCE_EXTENSIONS,
  SOURCE_GLOB,
} from "./scripts/architecture/imports.mjs";
import createFeatureCycleRule from "./scripts/architecture/no-feature-cycle.mjs";

const PROJECT_ROOT = import.meta.dirname;
const resolveProjectImport = createProjectResolver(PROJECT_ROOT);
const extensionGlob = `{${SOURCE_EXTENSIONS.join(",")}}`;
const moduleExtensions = SOURCE_EXTENSIONS.map((extension) => `.${extension}`);
const componentEntryPattern = new RegExp(
  `^index\\.(?:d\\.)?(?:${SOURCE_EXTENSIONS.join("|")})$`,
);
const componentSourceEntryPattern = new RegExp(
  `^index\\.(?:${SOURCE_EXTENSIONS.join("|")})$`,
);

// import 分组：npm/Node 包与副作用导入、@/ 别名、相对路径、CSS。
const importGroups = [
  ["^\\u0000", "^node:", "^@?\\w"],
  ["^@/"],
  ["^\\.\\.?(/|$)"],
  ["\\.css$"],
];

// 同层和下层依赖允许；文件和 feature 循环分别由 import/no-cycle、architecture/no-feature-cycle 检查。
// 和 .claude/rules/architecture.md「Layers」「Feature structure」两张表一一对应，改一边要同步另一边。
const ROOT_LAYERS = [
  { name: "app/", files: ["app/**"] },
  { name: "features/", files: ["features/**"] },
  {
    name: "components/",
    files: ["components/!(ui)/**", `components/*.${extensionGlob}`],
  },
  { name: "components/ui/", files: ["components/ui/**"] },
  { name: "hooks/", files: ["hooks/**"] },
  { name: "lib/", files: ["lib/**"] },
  { name: "utils/", files: ["utils/**"] },
  { name: "constants/", files: ["constants/**"] },
  { name: "types/", files: ["types/**"] },
];

const FEATURE_LAYERS = [
  "components",
  "hooks",
  "stores",
  "api",
  "utils",
  "constants",
  "types",
].map((dir) => ({
  name: `features/{name}/${dir}/`,
  files: [`features/*/${dir}/**`],
}));

// import/no-restricted-paths 的 except 不按 basePath 解析，所以这里不用 except，全部用 glob 表达
function layerZones(layers, section) {
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
  const parts = relative(PROJECT_ROOT, filename).split(sep);
  const componentsIndex = parts.lastIndexOf("components");
  if (parts[0] === ".." || componentsIndex === -1) return null;
  // ui/ 是组件集合；components/ui/dialog/ 才是独立组件目录。
  const componentIndex =
    componentsIndex + (parts[componentsIndex + 1] === "ui" ? 2 : 1);
  if (parts.length <= componentIndex + 1) return null;
  return resolve(PROJECT_ROOT, ...parts.slice(0, componentIndex + 1));
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
        // The feature rule already reports this convention inside features.
        if (!imported.isRelative && !featurePath(PROJECT_ROOT, filename)) {
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
          directory: relative(PROJECT_ROOT, targetDirectory)
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
              directory: relative(PROJECT_ROOT, directory).split(sep).join("/"),
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
    const sourceParts = featurePath(PROJECT_ROOT, filename);
    const sourceFeature = sourceParts?.[0];

    function check(source) {
      const imported = projectImport(filename, source);
      if (!imported) return;
      const { target, isRelative, isAlias } = imported;
      const targetParts = featurePath(PROJECT_ROOT, target);
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
    if (featurePath(PROJECT_ROOT, filename)) return {};
    const sourceComponent = componentDirectory(filename);

    return importVisitors((source) => {
      const imported = projectImport(filename, source);
      if (!imported) return;
      const { target, isRelative } = imported;
      // feature 由 feature-imports 检查，同一组件目录由 component-imports 检查，node_modules 由 import/no-relative-packages 检查。
      if (
        featurePath(PROJECT_ROOT, target) ||
        (sourceComponent && componentDirectory(target) === sourceComponent) ||
        relative(PROJECT_ROOT, target).split(sep).includes("node_modules")
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

const reactQueryWrappers = new Set(
  ["react-query", "react-query.client"].flatMap((name) =>
    SOURCE_EXTENSIONS.map((extension) =>
      resolve(PROJECT_ROOT, `lib/${name}.${extension}`),
    ),
  ),
);
const privateReactQueryFiles = new Set(
  SOURCE_EXTENSIONS.map((extension) =>
    resolve(PROJECT_ROOT, `lib/react-query.client.${extension}`),
  ),
);

const wrapperImportsRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      wrapper:
        "Import from @/lib/react-query. Only the react-query wrapper files may access the original package or the private client module.",
    },
  },
  create(context) {
    const filename = context.filename;
    if (reactQueryWrappers.has(filename)) return {};

    return importVisitors((source) => {
      const specifier = importSpecifier(source);
      if (!specifier) return;
      const originalPackage =
        specifier === "@tanstack/react-query" ||
        specifier.startsWith("@tanstack/react-query/");
      const imported = projectImport(filename, source);
      const privateClient =
        imported &&
        (privateReactQueryFiles.has(imported.target) ||
          imported.target === resolve(PROJECT_ROOT, "lib/react-query.client"));
      if (originalPackage || privateClient) {
        context.report({ node: source, messageId: "wrapper" });
      }
    });
  },
};

const kebabCase = /[a-z0-9]+(?:-[a-z0-9]+)*/.source;
const routeParam = /[a-z][a-zA-Z0-9]*/.source;
// 文件名按 . 分段检查（basic.example.tsx、index.d.ts）；允许 . 开头的目录和文件（.claude/）。
const kebabCaseName = new RegExp(
  String.raw`^\.?${kebabCase}(?:\.${kebabCase})*$`,
);
// app/ 下的目录还可以用 Next.js 路由写法：拦截前缀 (.)、(..)、(...)，(group)、@slot、_private，
// 动态段 [param]、[...param]、[[...param]]。动态段名是 params 的 key，和 Next.js 文档一样用 camelCase。
const appRouteDirectoryName = new RegExp(
  String.raw`^(?:\(\.\)|\(\.\.\.\)|(?:\(\.\.\))+)?(?:${kebabCase}|\(${kebabCase}\)|@${kebabCase}|_${kebabCase}|\[(?:\.\.\.)?${routeParam}\]|\[\[\.\.\.${routeParam}\]\])$`,
);

// ESLint 只处理源码文件，所以只覆盖源码文件和它们所在的目录；CSS、图片、Markdown 等不在检查范围内。
const kebabCasePathRule = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      name: "Use kebab-case for file and directory names: {{names}} in {{path}}. Dots separate name segments (basic.example.tsx). Under app/, Next.js route folders such as (group), @slot, _private, [param] and [...param] are also allowed.",
    },
  },
  create(context) {
    const parts = relative(PROJECT_ROOT, context.filename).split(sep);
    if (parts[0] === "..") return {};
    const invalid = parts.filter((part, index) => {
      if (kebabCaseName.test(part)) return false;
      const isAppDirectory =
        parts[0] === "app" && index > 0 && index < parts.length - 1;
      return !(isAppDirectory && appRouteDirectoryName.test(part));
    });
    if (invalid.length === 0) return {};

    return {
      Program(node) {
        context.report({
          node,
          messageId: "name",
          data: { names: invalid.join(", "), path: parts.join("/") },
        });
      },
    };
  },
};

const COMPONENT_INDEX_EXPORT_MESSAGE =
  "List public API members explicitly in the component entry. Use named exports instead of export * or namespace re-exports.";

const eslintConfig = defineConfig([
  ...nextVitals.map((config) =>
    config.name === "next"
      ? {
          ...config,
          // Keep Next's parser, plugins and resolvers active for every supported extension, including .cjs.
          files: [SOURCE_GLOB],
          settings: {
            ...config.settings,
            "import/extensions": moduleExtensions,
            "import/resolver": Object.fromEntries(
              Object.entries(config.settings["import/resolver"]).map(
                ([name, options]) => [
                  name,
                  {
                    ...options,
                    extensions: [...moduleExtensions, ".json", ".d.ts"],
                  },
                ],
              ),
            ),
          },
        }
      : config,
  ),
  ...nextTs,
  // any 和 @ts-ignore 由 nextTs 里 typescript-eslint recommended 的 no-explicit-any、ban-ts-comment 检查；enum 由 tsconfig 的 erasableSyntaxOnly 检查。
  {
    files: [SOURCE_GLOB],
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      // 用 warn：优先用 type guard 或 optional chaining，DOM、第三方类型等确实需要断言的地方可以保留。
      "@typescript-eslint/consistent-type-assertions": [
        "warn",
        { assertionStyle: "never" },
      ],
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },
  {
    files: [SOURCE_GLOB],
    // node_modules 里的包不会反向 import 项目代码，不用解析它们的导出。不忽略的话，import/no-cycle 会逐个解析
    // @tabler/icons-react 的几千个图标模块和 9MB 的 typescript.js，整体 lint 慢 5 倍以上。
    settings: { "import/ignore": ["node_modules"] },
    plugins: {
      "simple-import-sort": simpleImportSort,
      architecture: {
        rules: {
          "feature-imports": featureImportsRule,
          "root-imports": rootImportsRule,
          "no-feature-cycle": createFeatureCycleRule(PROJECT_ROOT),
          "component-imports": componentImportsRule,
          "component-entry": componentEntryRule,
          "component-exports": componentExportsRule,
          "wrapper-imports": wrapperImportsRule,
        },
      },
      naming: {
        rules: {
          "kebab-case": kebabCasePathRule,
        },
      },
    },
    rules: {
      "simple-import-sort/imports": ["error", { groups: importGroups }],
      "architecture/feature-imports": "error",
      "architecture/no-feature-cycle": "error",
      "architecture/component-imports": "error",
      "architecture/component-entry": "error",
      "architecture/wrapper-imports": "error",
      "naming/kebab-case": "error",
      "import/no-relative-packages": "error",
      "import/no-cycle": ["error", { commonjs: true }],
      "import/no-restricted-paths": [
        "error",
        {
          basePath: PROJECT_ROOT,
          zones: [
            ...layerZones(ROOT_LAYERS, "Layers"),
            ...layerZones(FEATURE_LAYERS, "Feature structure"),
          ],
        },
      ],
    },
  },
  {
    // 只查应用代码目录：scripts/ 和根目录配置文件不经过 Next.js 打包，解析不了 @/。
    files: ROOT_LAYERS.flatMap((layer) => layer.files),
    rules: { "architecture/root-imports": "error" },
  },
  {
    files: [
      `**/components/!(ui)/index.${extensionGlob}`,
      `**/components/ui/*/index.${extensionGlob}`,
    ],
    rules: {
      "architecture/component-exports": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message: COMPONENT_INDEX_EXPORT_MESSAGE,
        },
        {
          selector: "ExportNamespaceSpecifier",
          message: COMPONENT_INDEX_EXPORT_MESSAGE,
        },
      ],
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    ignores: [
      "**/*.{test,spec,story,stories,generated,gen}.{jsx,tsx}",
      "**/{test,tests,__tests__,stories,generated,__generated__}/**",
    ],
    rules: {
      "max-lines-per-function": [
        "warn",
        {
          max: 150,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      "max-lines": [
        "warn",
        {
          max: 200,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code 把 worktree 建在仓库内；每个 worktree 在自己的 checkout 里 lint。
    ".claude/worktrees/**",
  ]),
  // 放在所有规则之后，关闭与 Prettier 重叠或冲突的格式规则。
  eslintConfigPrettier,
]);

export default eslintConfig;
