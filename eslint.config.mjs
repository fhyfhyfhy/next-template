import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import pluginQuery from "@tanstack/eslint-plugin-query";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import i18next from "eslint-plugin-i18next";
import playwright from "eslint-plugin-playwright";
import simpleImportSort from "eslint-plugin-simple-import-sort";

import { BUILD_DIRS } from "./scripts/build-dirs.mjs";
import createArchitecturePlugin, {
  layerZones,
} from "./scripts/eslint/architecture-plugin.mjs";
import e2ePlugin from "./scripts/eslint/e2e-plugin.mjs";
import createI18nPlugin from "./scripts/eslint/i18n-plugin.mjs";
import { SOURCE_EXTENSIONS, SOURCE_GLOB } from "./scripts/eslint/imports.mjs";
import createNamingPlugin from "./scripts/eslint/naming-plugin.mjs";
import withWrapperImports, {
  apiFileFactoriesRule,
  mutationCallbacksRule,
} from "./scripts/eslint/query-plugin.mjs";
import { TAILWIND_PALETTES } from "./scripts/eslint/tailwind-palettes.mjs";

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
  "server",
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

// i18n 里借用 no-restricted-imports、no-restricted-syntax 的两组限制。这两条规则还管着别的事，所以这两组合进
// 下面的 RESTRICTED_IMPORTS 和 RESTRICTED_SYNTAX；i18n 的其余检查和这两组的例外在配置数组的「i18n」一段。
//
// 文案只经 lib/i18n/client-messages 的 ClientMessages 下发：直接用 next-intl 的 provider 和 useMessages，
// i18n/client-namespaces 就查不到。
const INTL_PROVIDER_RESTRICTION = {
  name: "next-intl",
  importNames: ["NextIntlClientProvider", "useMessages"],
  message:
    "Send messages to Client Components with ClientMessages from @/lib/i18n/client-messages, so i18n/client-namespaces can check them. See .claude/rules/i18n.md.",
};
// 日期和时间按电脑所在时区显示，只有浏览器知道这个时区，所以只由 components/date-time.tsx 格式化。
const DATE_TIME_MESSAGE =
  "Show a date or time with <DateTime> from @/components/date-time, which renders it in the browser in the computer's time zone. See .claude/rules/i18n.md.";
const DATE_TIME_FORMATTING = [
  {
    selector: "CallExpression[callee.property.name=/^dateTime(Range)?$/]",
    message: DATE_TIME_MESSAGE,
  },
  {
    selector:
      "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']",
    message: DATE_TIME_MESSAGE,
  },
];

// 避免另起 axios/SWR 数据通路，统一使用项目的 fetchApi 和 React Query。
const RESTRICTED_IMPORTS = {
  paths: [
    ...["axios", "swr"].map((name) => ({
      name,
      message: QUERY_LIBRARY_MESSAGE,
    })),
    INTL_PROVIDER_RESTRICTION,
  ],
  patterns: [{ group: ["axios/*", "swr/*"], message: QUERY_LIBRARY_MESSAGE }],
};

const COMPONENT_INDEX_EXPORT_MESSAGE =
  "List public API members explicitly in the component entry. Use named exports instead of export * or namespace re-exports.";

// 应用的部署设置的环境变量只通过 lib/env.ts 读。Node 和 Next 定义的变量直接读，只放行 `process.env.名字`
// 这种写法：打包器只替换这种写法。
const FRAMEWORK_ENV = "/^(NODE_ENV|(__)?NEXT_(?!PUBLIC_)\\w+)$/";
const ENV_ACCESS = [
  {
    selector: `MemberExpression[object.name='process'][property.name='env']:not(MemberExpression[computed=false][property.name=${FRAMEWORK_ENV}] > .object)`,
    message:
      "Read environment variables through env from @/lib/env, which declares and validates them. See AGENTS.md § Environment variables.",
  },
];

// 所有应用代码都受的 no-restricted-syntax 限制。
const RESTRICTED_SYNTAX = [...DATE_TIME_FORMATTING, ...ENV_ACCESS];

// 给豁免 RESTRICTED_SYNTAX 里一组限制的文件用，其余限制照旧。只设置级别的配置会沿用前面的选项，
// 所以没有剩下的限制时直接关掉这条规则。
function restrictedSyntaxWithout(group) {
  const rest = RESTRICTED_SYNTAX.filter(
    (restriction) => !group.includes(restriction),
  );
  return rest.length ? ["error", ...rest] : "off";
}

// 会进页面的代码，包括 monorepo 里 workspace 包的源码；scripts/、e2e/、测试和根目录的配置文件不进页面。
const APPLICATION_CODE = {
  files: [SOURCE_GLOB],
  ignores: [
    `**/*.{test,spec}.${extensionGlob}`,
    "scripts/**",
    "e2e/**",
    `*.${extensionGlob}`,
  ],
};

// 颜色只用 app/globals.css 的语义 token 和 black、white，圆角只用内置或 --radius-* token。
const RESTRICTED_TAILWIND_CLASSES = [
  {
    pattern: `^(?:.*:)?!?[a-z-]+-(?:${TAILWIND_PALETTES.join("|")})-\\d+(?:/.+)?!?$`,
    message:
      'Use a semantic color token from app/globals.css instead of the Tailwind palette color "$0".',
  },
  {
    // 任意值里的十六进制色值和颜色函数；引用 CSS 变量的写法不受限制。
    // 任意值用 _ 代替空格，_ 属于 \w，所以边界用显式字符集而不是 \b、\w。
    pattern:
      "^.*\\[[^\\]]*(?:#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z-])|(?<![a-zA-Z-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\().*$",
    message:
      'Define a color token in app/globals.css instead of the hard-coded color in "$0".',
  },
  {
    // 只需拦任意值：不是任意值、又不在内置或 --radius-* 主题里的圆角 class 由 no-unknown-classes 报出。
    pattern: "^(?:.*:)?!?rounded(?:-[a-z]{1,2})?-[[(].*$",
    message:
      'Use a built-in radius or a --radius-* token from app/globals.css instead of "$0".',
  },
];

// ESLint 不会跨配置对象合并同一条规则的选项：后面的对象给某个文件设置 no-restricted-imports 或
// no-restricted-syntax，会整个替换前面的选项。所以下面设置其中一条的对象都列出它的文件受的全部限制，
// 把 RESTRICTED_IMPORTS 和 RESTRICTED_SYNTAX 展开进去；eslint.config.test.mjs 检查它们都成立。
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
      "no-restricted-imports": ["error", RESTRICTED_IMPORTS],
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
                'e2e/ observes the app only through the browser and the Demo backend\'s control endpoints, so it imports no application code. See "Where files go" in .claude/rules/architecture.md.',
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
    ...APPLICATION_CODE,
    rules: { "no-restricted-syntax": ["error", ...RESTRICTED_SYNTAX] },
  },
  {
    // Next 在应用进程里加载的根目录文件也是应用代码；APPLICATION_CODE 排除根目录，是为了跳过各种工具的配置文件。
    files: [`{proxy,instrumentation}.${extensionGlob}`],
    rules: { "no-restricted-syntax": ["error", ...RESTRICTED_SYNTAX] },
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
        ...RESTRICTED_SYNTAX,
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
  // ---- i18n（.claude/rules/i18n.md）----
  // - i18next/no-literal-string：用户看得到的文案放进 messages/，用 t() 渲染。
  // - i18n/client-namespaces：每个 ClientMessages 下发的 namespace 和它包着的 Client Component 用到的一致。
  // - INTL_PROVIDER_RESTRICTION、DATE_TIME_FORMATTING：前面随 RESTRICTED_IMPORTS、RESTRICTED_SYNTAX 生效，
  //   这里只放它们的例外，所以这一段要排在设置那两条规则的配置之后。
  {
    // 只查 JSX 里的文本和下面这些属性，JSX 之外的文案（toast、metadata、常量里的标签）由 rule 约束。
    // 各组件的 *-examples/ 目录保留字面量：example 和 playground 要能单独复制，控件标签是 prop 名，
    // 组件 metadata 由生成脚本直接读取字面值。
    files: ["{app,features,components}/**/*.{jsx,tsx}"],
    ignores: [
      "features/demo-ui/components/*-examples/**",
      "**/*.{test,spec}.{jsx,tsx}",
    ],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": {
            include: [
              "aria-label",
              "aria-description",
              "aria-valuetext",
              "title",
              "placeholder",
              "alt",
              "label",
              "description",
            ],
          },
          // 设置后会替换插件的默认列表：前一项是默认值，最后一项放行 next-intl 的 t.rich 这类调用里的 key。
          callees: {
            exclude: [
              "i18n(ext)?",
              "t",
              "require",
              "addEventListener",
              "removeEventListener",
              "postMessage",
              "getElementById",
              "dispatch",
              "commit",
              "includes",
              "indexOf",
              "endsWith",
              "startsWith",
              "t\\.(rich|markup|raw|has)",
            ],
          },
          message:
            "Move user-visible text into messages/ and render it with t() (.claude/rules/i18n.md)",
        },
      ],
    },
  },
  {
    ...APPLICATION_CODE,
    plugins: { i18n: createI18nPlugin(PROJECT_ROOT) },
    rules: {
      // --fix 改写列表。分析整个项目，一个文件的结果取决于别的文件，lint 不能加 --cache。
      "i18n/client-namespaces": "error",
    },
  },
  {
    // ClientMessages 自己要用 next-intl 的 provider 和 useMessages，在路由之外渲染组件的单元测试也要用。
    files: ["lib/i18n/**", `**/*.test.${extensionGlob}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          ...RESTRICTED_IMPORTS,
          paths: RESTRICTED_IMPORTS.paths.filter(
            (path) => path !== INTL_PROVIDER_RESTRICTION,
          ),
        },
      ],
    },
  },
  {
    // 唯一格式化日期和时间的地方。
    files: ["components/date-time.tsx"],
    rules: {
      "no-restricted-syntax": restrictedSyntaxWithout(DATE_TIME_FORMATTING),
    },
  },
  // ---- i18n 结束 ----
  {
    // 唯一读应用环境变量的地方。
    files: ["lib/env.ts"],
    rules: {
      "no-restricted-syntax": restrictedSyntaxWithout(ENV_ACCESS),
    },
  },
  {
    files: [SOURCE_GLOB],
    // 测试里的 class 是 cn() 等函数的输入，不会渲染，会故意拼接或写成非规范形式。
    ignores: [`**/*.{test,spec}.${extensionGlob}`],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": {
        entryPoint: "app/globals.css",
        // 不设时插件不做 px 到 rem 的换算，lg:max-h-[520px] 这类可以写成 lg:max-h-130 的 class 就查不出来。
        // globals.css 没有改根字号，按浏览器默认的 16px 算，和 Tailwind CSS IntelliSense 的默认值一致。
        rootFontSize: 16,
      },
    },
    // class 的排序、去重和空白由 prettier-plugin-tailwindcss 处理，这里只开它覆盖不到的规则。
    rules: {
      // 按 Tailwind 的 canonicalizeCandidates 改成规范写法，与编辑器里 IntelliSense 的提示一致。
      "better-tailwindcss/enforce-canonical-classes": "error",
      // 不在 Tailwind 和项目主题里的 class 不会生成样式，多半是拼写错误。
      "better-tailwindcss/no-unknown-classes": "error",
      // 同一字符串里设置相同 CSS 属性的 class 会互相覆盖，结果取决于生成顺序而不是书写顺序。
      "better-tailwindcss/no-conflicting-classes": "error",
      // 替换当前 Tailwind 版本已废弃的 class。
      "better-tailwindcss/no-deprecated-classes": "error",
      // Tailwind 按完整 class 名扫描源码，拼接出来的 class 不会生成样式。
      "better-tailwindcss/no-concatenated-classes": "error",
      // 颜色和圆角走主题 token，见 RESTRICTED_TAILWIND_CLASSES。
      "better-tailwindcss/no-restricted-classes": [
        "error",
        { restrict: RESTRICTED_TAILWIND_CLASSES },
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
    plugins: {
      ...playwright.configs["flat/recommended"].plugins,
      e2e: e2ePlugin,
    },
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      // 断言写在 expectXxx helper 里的用例也算有断言。
      "playwright/expect-expect": [
        "warn",
        { assertFunctionPatterns: ["^expect[A-Z]"] },
      ],
      // 整页加载后先等页面 hydrate 再操作，否则点击可能落在 React 接管之前（.claude/rules/e2e.md）。
      "e2e/act-after-ready": "error",
    },
  },
  {
    files: ["e2e/**"],
    ignores: ["e2e/test.ts"],
    rules: {
      // e2e/test.ts 的 test 带着全局 fixture（比如页面缺少文案时失败），直接用 Playwright 的 test 会绕过它们。
      // 同一条规则在后面的配置里会整个替换前面的选项，所以带上全局的限制再追加。
      "no-restricted-imports": [
        "error",
        {
          ...RESTRICTED_IMPORTS,
          paths: [
            ...RESTRICTED_IMPORTS.paths,
            {
              name: "@playwright/test",
              importNames: ["test", "expect"],
              message:
                "Import test and expect from e2e/test.ts, which adds the fixtures every spec runs with.",
            },
          ],
        },
      ],
    },
  },
  // 项目级忽略项在 Next 默认项上加入 worktree，避免重复检查其他 checkout。
  globalIgnores([
    // 保留 Next 默认排除的构建产物与生成类型；其余 .next-* 是 demo:* 命令和 e2e 的产物目录（scripts/build-dirs.mjs）。
    ...BUILD_DIRS.map((dir) => `${dir}/**`),
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
