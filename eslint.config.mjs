import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import pluginQuery from "@tanstack/eslint-plugin-query";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import playwright from "eslint-plugin-playwright";
import simpleImportSort from "eslint-plugin-simple-import-sort";

import createArchitecturePlugin, {
  layerZones,
} from "./scripts/eslint/architecture-plugin.mjs";
import { SOURCE_EXTENSIONS, SOURCE_GLOB } from "./scripts/eslint/imports.mjs";
import createNamingPlugin from "./scripts/eslint/naming-plugin.mjs";
import withWrapperImports, {
  apiFileFactoriesRule,
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
  // 使用 Next.js 的 React、Hooks、可访问性和性能规则，随框架版本维护默认检查。
  ...nextVitals.map((config) =>
    config.name === "next"
      ? {
          ...config,
          // 所有支持的扩展名（含 .cjs）都需要 Next 的 parser、插件和 resolver。
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
  // 复用 TypeScript 推荐检查，包括禁止显式 any、要求用有说明的 @ts-expect-error 代替 @ts-ignore。
  // enum 由 tsconfig 的 erasableSyntaxOnly 检查。
  ...nextTs,
  {
    files: [SOURCE_GLOB],
    plugins: { "@eslint-community/eslint-comments": eslintComments },
    rules: {
      // ESLint 指令注释须在 -- 后说明原因，方便审查禁用规则等局部配置的必要性。
      "@eslint-community/eslint-comments/require-description": "error",
      // 对象字面量类型定义统一用 interface，避免同类契约在两种写法之间来回切换。
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      // 对类型断言发出 warn，优先用类型标注或类型收窄；允许 const 断言。
      "@typescript-eslint/consistent-type-assertions": [
        "warn",
        { assertionStyle: "never" },
      ],
      // 用 warn 提醒处理 null/undefined，避免非空断言 ! 隐藏实际可能为空的值。
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
          "api-file-factories": apiFileFactoriesRule,
        },
      },
    },
    rules: {
      // 按 importGroups 固定顺序并支持自动修复，减少增删依赖时无关的排序 diff。
      "simple-import-sort/imports": ["error", { groups: importGroups }],
      // feature 内部用相对路径且不反向引用自身公共入口。
      // 跨边界用 @/；访问其他 feature 时只走公共入口。
      "architecture/feature-imports": "error",
      // 按 feature 聚合依赖（含类型引用），捕获文件图无环但 feature 之间互相依赖的情况。
      "architecture/no-feature-cycle": "error",
      // 组件目录内用相对路径，对外只开放 index 入口，避免调用方依赖私有实现路径。
      "architecture/component-imports": "error",
      // 每个组件目录只保留一个实现入口，避免多个 index 扩展名产生解析歧义；允许声明文件并存。
      "architecture/component-entry": "error",
      // 约束条件导入的调用方、目标及顺序，防止未经支持的 # 路径绕过架构检查。
      "architecture/package-imports": "error",
      // React Query 统一从项目封装引入，避免直接使用原包而绕过项目的 QueryClient 策略。
      "architecture/wrapper-imports": "error",
      // 源码路径统一用 kebab-case，同时保留 Next.js 路由目录的特殊命名约定。
      "naming/kebab-case": "error",
      // 保留 factory 负责的缓存更新；调用方的成功、失败及结束回调放在 mutate 的第二个参数。
      "data-fetching/mutation-callbacks": "error",
      // 跨 package 的依赖使用包名，避免相对路径穿透另一个包的边界。
      "import/no-relative-packages": "error",
      // 避免另起 axios/SWR 数据通路，统一使用项目的 fetchApi 和 React Query。
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
      // 检查可解析的文件依赖环，忽略纯类型导入；跨 feature 的聚合循环由专用规则检查。
      "import/no-cycle": ["error", { commonjs: true }],
      // 按层级表禁止下层引用上层，让依赖方向与项目架构保持一致。
      "import/no-restricted-paths": [
        "error",
        {
          basePath: PROJECT_ROOT,
          zones: [
            ...layerZones(ROOT_LAYERS, "Layers"),
            ...layerZones(FEATURE_LAYERS, "Feature structure"),
            {
              target: ["e2e/**"],
              from: ROOT_LAYERS.flatMap((layer) => layer.files),
              message:
                'e2e/ observes the app only through the browser and the Mock API control endpoints, so it imports no application code. See "Where files go" in .claude/rules/architecture.md.',
            },
          ],
        },
      ],
    },
  },
  // 复用 TanStack 的严格推荐检查；queryPlugin 让这些规则识别项目封装的 import。
  ...pluginQuery.configs["flat/recommended-strict"].map((config) => ({
    ...config,
    files: [SOURCE_GLOB],
    plugins: { "@tanstack/query": queryPlugin },
  })),
  {
    // 只查应用代码目录：scripts/ 和根目录配置文件不经过 Next.js 打包，解析不了 @/。
    files: ROOT_LAYERS.flatMap((layer) => layer.files),
    rules: {
      // 当前目录及子目录用相对路径，跨目录用 @/；feature 和组件内部交给各自的规则。
      "architecture/root-imports": "error",
    },
  },
  {
    files: [
      `**/components/!(ui)/index.${extensionGlob}`,
      `**/components/ui/*/index.${extensionGlob}`,
    ],
    rules: {
      // 追踪导入的 namespace 及其 const 别名，避免入口间接暴露整个命名空间。
      "architecture/component-exports": "error",
      // 禁止入口直接使用 export * 和 export * as，要求显式列出公开成员。
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
      // 函数过长时提醒检查职责，避免一个组件或 helper 承担过多逻辑。
      "max-lines-per-function": [
        "warn",
        {
          max: 150,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      // 文件过长时提醒检查拆分；使用 warn，让职责单一的大组件仍可保留。
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
  {
    files: ["features/*/api/**"],
    rules: {
      // options 工厂跟着文件名里的 HTTP 方法走，读接口的工厂不会混进写接口的文件，反之亦然。
      "data-fetching/api-file-factories": "error",
    },
  },
  // Playwright 推荐的 e2e 检查，比如不用固定时长的等待、expect.poll 必须 await。
  {
    ...playwright.configs["flat/recommended"],
    files: ["e2e/**"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      // 断言写在 expectXxx helper 里的用例也算有断言。
      "playwright/expect-expect": [
        "warn",
        { assertFunctionPatterns: ["^expect[A-Z]"] },
      ],
    },
  },
  // 项目级忽略项在 Next 默认项上加入 worktree，避免重复检查其他 checkout。
  globalIgnores([
    // 保留 Next 默认排除的构建产物与生成类型；.next-demo 是 demo:* 命令的产物目录（见 next.config.ts）。
    ".next/**",
    ".next-demo/**",
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
