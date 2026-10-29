import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import pluginQuery from "@tanstack/eslint-plugin-query";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";

import createArchitecturePlugin, {
  layerZones,
} from "./scripts/eslint/architecture-plugin.mjs";
import { SOURCE_EXTENSIONS, SOURCE_GLOB } from "./scripts/eslint/imports.mjs";
import createNamingPlugin from "./scripts/eslint/naming-plugin.mjs";
import withWrapperImports, {
  mutationCallbacksRule,
} from "./scripts/eslint/query-plugin.mjs";

const PROJECT_ROOT = import.meta.dirname;
const extensionGlob = `{${SOURCE_EXTENSIONS.join(",")}}`;
const moduleExtensions = SOURCE_EXTENSIONS.map((extension) => `.${extension}`);

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

const queryPlugin = withWrapperImports(pluginQuery);
const QUERY_LIBRARY_MESSAGE =
  "Request server data with fetchApi from @/lib/fetch and React Query from @/lib/react-query. See .claude/rules/data-fetching.md.";

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
    plugins: { "@eslint-community/eslint-comments": eslintComments },
    rules: {
      // 用 eslint-disable 关掉 no-explicit-any 等规则时，要在 -- 后写明原因，和 ban-ts-comment 对 @ts-expect-error 的要求一致。
      "@eslint-community/eslint-comments/require-description": "error",
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
      architecture: createArchitecturePlugin(PROJECT_ROOT),
      naming: createNamingPlugin(PROJECT_ROOT),
      "data-fetching": {
        rules: {
          "mutation-callbacks": mutationCallbacksRule,
        },
      },
    },
    rules: {
      "simple-import-sort/imports": ["error", { groups: importGroups }],
      "architecture/feature-imports": "error",
      "architecture/no-feature-cycle": "error",
      "architecture/component-imports": "error",
      "architecture/component-entry": "error",
      "architecture/package-imports": "error",
      "architecture/wrapper-imports": "error",
      "naming/kebab-case": "error",
      "data-fetching/mutation-callbacks": "error",
      "import/no-relative-packages": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: ["axios", "swr"].map((name) => ({
            name,
            message: QUERY_LIBRARY_MESSAGE,
          })),
          patterns: [
            { group: ["axios/*", "swr/*"], message: QUERY_LIBRARY_MESSAGE },
          ],
        },
      ],
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
  ...pluginQuery.configs["flat/recommended-strict"].map((config) => ({
    ...config,
    files: [SOURCE_GLOB],
    plugins: { "@tanstack/query": queryPlugin },
  })),
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
