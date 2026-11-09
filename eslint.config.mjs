import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import markdown from "@eslint/markdown";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import eslintReact from "@eslint-react/eslint-plugin";
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
import createDataFlowPlugin from "./scripts/eslint/data-flow-plugin.mjs";
import e2ePlugin from "./scripts/eslint/e2e-plugin.mjs";
import createI18nPlugin from "./scripts/eslint/i18n-plugin.mjs";
import { SOURCE_EXTENSIONS, SOURCE_GLOB } from "./scripts/eslint/imports.mjs";
import createNamingPlugin from "./scripts/eslint/naming-plugin.mjs";
import withWrapperImports, {
  apiFileFactoriesRule,
  mutationCallbacksRule,
} from "./scripts/eslint/query-plugin.mjs";
import securityPlugin from "./scripts/eslint/security-plugin.mjs";
import { TAILWIND_PALETTES } from "./scripts/eslint/tailwind-palettes.mjs";
import writingStylePlugin from "./scripts/eslint/writing-style-plugin.mjs";

const PROJECT_ROOT = import.meta.dirname;
// 源码和 docs/features.md 两组配置共用一个实例：同名插件在两个配置对象里必须是同一个对象。
const architecturePlugin = createArchitecturePlugin(PROJECT_ROOT);
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

// agent 读的指令，用英文写。和 .claude/rules/writing-style.md「Language by content」表里 Agent instructions
// 一行对应，改一边要同步另一边。
const AGENT_INSTRUCTIONS = [
  "AGENTS.md",
  "CLAUDE.md",
  ".claude/rules/**/*.md",
  ".agents/**/*.md",
  "docs/agents/**/*.md",
];

// TanStack 官方规则和本地规则合成一个插件，规则名统一用官方的前缀 @tanstack/query/*。
// withWrapperImports 让官方规则识别从 @/lib/react-query 封装的 import。
const tanstackQueryPlugin = withWrapperImports(pluginQuery);
tanstackQueryPlugin.rules["mutation-callbacks"] = mutationCallbacksRule;
tanstackQueryPlugin.rules["api-file-factories"] = apiFileFactoriesRule;
const QUERY_LIBRARY_MESSAGE =
  "Request server data with fetchApi from @/lib/fetch and React Query from @/lib/react-query. See .claude/rules/data-flow.md.";

// i18n 里借用 no-restricted-imports、no-restricted-syntax 的几组限制。这两条规则还管着别的事，所以这几组合进
// 下面的 RESTRICTED_IMPORTS 和 RESTRICTED_SYNTAX；i18n 的其余检查和这几组的例外在配置数组的「i18n」一段。
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
// 翻译函数不按 namespace 取，key 写完整路径：整个 app 只有一种 t，可以传给任何 owner 的 options 工厂和
// schema 工厂，它们读自己的文案。key 归谁由 i18n/message-keys 检查。
const TRANSLATOR_NAMESPACE_MESSAGE =
  "Call useTranslations() and getTranslations() without a namespace, and write each key's full path, starting with the namespace of the file's owner, such as t(\"task.comments.createFailed\"). See .claude/rules/i18n.md.";
const TRANSLATOR_NAMESPACE = [
  {
    selector:
      "CallExpression[callee.name='useTranslations'][arguments.length>0]",
    message: TRANSLATOR_NAMESPACE_MESSAGE,
  },
  {
    selector:
      "CallExpression[callee.name='getTranslations'] > :matches(Literal, TemplateLiteral)",
    message: TRANSLATOR_NAMESPACE_MESSAGE,
  },
  {
    selector:
      "CallExpression[callee.name='getTranslations'] > ObjectExpression > Property[key.name='namespace']",
    message: TRANSLATOR_NAMESPACE_MESSAGE,
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

// Base UI 有对应组件的原生元素只在 components/ui/ 的封装里渲染，别处渲染封装，样式、状态和可访问性才一致。
// 选择器只匹配小写的原生标签：<Form>、<form.Field> 这类组件和成员表达式不受影响。
const nativeElement = (element, replacement, condition = "") => ({
  selector: `JSXOpeningElement[name.name='${element}']${condition}`,
  message: `Native <${element}> renders only inside components/ui/: use ${replacement}. See .claude/rules/components.md.`,
});
const NATIVE_ELEMENTS = [
  nativeElement("button", "Button from @/components/ui/button"),
  // Base UI 没有文件选择和隐藏字段的组件，这两种 input 保持原生。
  nativeElement(
    "input",
    "Input, Checkbox, or Switch from @/components/ui/",
    ":not(:has(JSXAttribute[name.name='type'] > Literal[value=/^(file|hidden)$/]))",
  ),
  nativeElement("select", "the Select parts from @/components/ui/select"),
  nativeElement("progress", "the Progress parts from @/components/ui/progress"),
  nativeElement("dialog", "the Dialog parts from @/components/ui/dialog"),
  nativeElement("form", "Form from @/components/ui/form"),
  ...[
    ["fieldset", "Fieldset"],
    ["meter", "Meter"],
    ["hr", "Separator"],
  ].map(([element, part]) =>
    nativeElement(
      element,
      `a wrapper of Base UI's ${part} in components/ui/, adding it first if it is missing`,
    ),
  ),
];

// 所有应用代码都受的 no-restricted-syntax 限制。
const RESTRICTED_SYNTAX = [
  ...DATE_TIME_FORMATTING,
  ...TRANSLATOR_NAMESPACE,
  ...ENV_ACCESS,
  ...NATIVE_ELEMENTS,
];

// 给豁免 RESTRICTED_SYNTAX 里一组限制的文件用，其余限制照旧。只设置级别的配置会沿用前面的选项，
// 所以没有剩下的限制时直接关掉这条规则。
function restrictedSyntaxWithout(group) {
  const rest = RESTRICTED_SYNTAX.filter(
    (restriction) => !group.includes(restriction),
  );
  return rest.length ? ["error", ...rest] : "off";
}

// 会进页面的代码：「Layers」表里的目录，测试除外。其余的目录不进页面，比如 scripts/、e2e/、根目录的配置文件，
// 以及派生项目自己加的测试或部署目录。
const APPLICATION_CODE = {
  files: ROOT_LAYERS.map(({ name }) => `${name}**/*.${extensionGlob}`),
  ignores: [`**/*.{test,spec}.${extensionGlob}`],
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

// 派生项目自己的检查和忽略项写在 eslint.config.project.mjs（.agents/skills/derived-project/SKILL.md），它导出的
// 配置接在 template 的规则后面、Prettier 之前；没有这个文件时只用 template 的配置。项目的限制写成自己插件里的独立
// 规则：在那里给文件设置 no-restricted-imports 或 no-restricted-syntax，会整个替换下面给同一批文件设的选项。
const PROJECT_CONFIG = join(PROJECT_ROOT, "eslint.config.project.mjs");
const projectConfig = existsSync(PROJECT_CONFIG)
  ? (await import(pathToFileURL(PROJECT_CONFIG).href)).default
  : [];

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
      // identifier 只用 ASCII 字母、数字、_ 和 $（.claude/rules/writing-style.md「Names and fixed terms」）。
      "id-match": [
        "error",
        "^[\\w$]+$",
        { properties: true, classFields: true },
      ],
    },
  },
  {
    files: [SOURCE_GLOB],
    plugins: { "@eslint-react": eslintReact },
    rules: {
      // React 19 的写法，见 .claude/rules/react.md。
      "@eslint-react/no-forward-ref": "error",
      "@eslint-react/no-use-context": "error",
      "@eslint-react/dom-no-use-form-state": "error",
      // no-context-provider 只按名字认出 context（<XxxContext.Provider>），所以 createContext 的结果都要叫 XxxContext。
      "@eslint-react/no-context-provider": "error",
      "@eslint-react/naming-convention-context-name": "error",
      // 原生 button 默认 type="submit"，放在 form 里点一下就会提交。
      "@eslint-react/dom-no-missing-button-type": "error",
      // 组件和 hook 加的监听、定时器、observer 要在 cleanup 里撤掉，否则卸载后还在跑。
      "@eslint-react/web-api-no-leaked-event-listener": "error",
      "@eslint-react/web-api-no-leaked-timeout": "error",
      "@eslint-react/web-api-no-leaked-interval": "error",
      "@eslint-react/web-api-no-leaked-resize-observer": "error",
      "@eslint-react/web-api-no-leaked-intersection-observer": "error",
    },
  },
  {
    files: [SOURCE_GLOB],
    // node_modules 里的包不会反向 import 项目代码，不用解析它们的导出。不忽略的话，import/no-cycle 会逐个解析
    // @tabler/icons-react 的几千个图标模块和 9MB 的 typescript.js，整体 lint 慢 5 倍以上。
    settings: { "import/ignore": ["node_modules"] },
    plugins: {
      "simple-import-sort": simpleImportSort,
      architecture: architecturePlugin,
      naming: createNamingPlugin(PROJECT_ROOT),
      "data-flow": createDataFlowPlugin(PROJECT_ROOT),
      "@tanstack/query": tanstackQueryPlugin,
    },
    rules: {
      // 按 importGroups 固定顺序并支持自动修复，减少增删依赖时无关的排序 diff。
      "simple-import-sort/imports": ["error", { groups: importGroups }],
      // feature 内部用相对路径且不反向引用自身公共入口。
      // 跨边界用 @/；访问其他 feature 时只走公共入口。
      "architecture/feature-imports": "error",
      // 按 feature 聚合依赖（含类型引用），捕获文件图无环但 feature 之间互相依赖的情况。
      "architecture/no-feature-cycle": "error",
      // feature 之间的每个依赖（含类型引用）都要在 docs/features.md 的依赖图里有对应的边。
      "architecture/feature-dependencies": "error",
      // 组件目录内用相对路径，对外只开放 index 入口，避免调用方依赖私有实现路径。
      "architecture/component-imports": "error",
      // 每个组件目录只保留一个实现入口，避免多个 index 扩展名产生解析歧义；允许声明文件并存。
      "architecture/component-entry": "error",
      // React Query 和 UI 库只经项目封装引入：绕过封装会丢掉 QueryClient 策略，或者项目统一的样式、默认值和行为。
      "architecture/wrapper-imports": "error",
      // 源码路径统一用 kebab-case，同时保留 Next.js 路由目录的特殊命名约定。
      "naming/kebab-case": "error",
      // 服务端代码直接调数据层，不用 fetchApi 请求本 app 自己的接口。
      "data-flow/no-server-self-fetch": "error",
      // feature 的 server/ 和 server.ts 只在服务端运行：import "server-only" 让它们进了浏览器的 bundle 就构建失败。
      "data-flow/server-only": "error",
      // 保留 factory 负责的缓存更新；调用方的成功、失败及结束回调放在 mutate 的第二个参数。
      "@tanstack/query/mutation-callbacks": "error",
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
                "e2e/ observes the app through the browser and writes its test data straight to the e2e database, so it imports no application code. See .claude/rules/e2e.md.",
            },
          ],
        },
      ],
    },
  },
  // 复用 TanStack 的严格推荐检查。
  ...pluginQuery.configs["flat/recommended-strict"].map((config) => ({
    ...config,
    files: [SOURCE_GLOB],
    plugins: { "@tanstack/query": tanstackQueryPlugin },
  })),
  {
    // 只查应用代码目录：scripts/ 和根目录配置文件不经过 Next.js 打包，解析不了 @/。
    files: ROOT_LAYERS.flatMap((layer) => layer.files),
    rules: {
      // 当前目录及子目录用相对路径，跨目录用 @/；app/ 内部全用相对路径；feature 和组件内部交给各自的规则。
      "architecture/root-imports": "error",
      // app/ 里的 _components/ 在所有使用方所在目录的最近公共祖先里：不被更高的文件引用，也不比需要的更高。
      "architecture/app-component-placement": "error",
    },
  },
  {
    // feature 导出的全大写常量放在它的 constants/。测试和 test helper 共用的测试数据跟着测试走。
    files: [SOURCE_GLOB],
    ignores: [
      `**/*.{test,spec}.${extensionGlob}`,
      `**/*-test-helpers.${extensionGlob}`,
    ],
    rules: { "architecture/feature-constants": "error" },
  },
  {
    ...APPLICATION_CODE,
    plugins: { security: securityPlugin },
    rules: {
      "no-restricted-syntax": ["error", ...RESTRICTED_SYNTAX],
      // 页面上的 HTML 只由 React 渲染：dangerouslySetInnerHTML 和 javascript: URL 都会把字符串当代码执行。
      // 任何组件都查，因为组件可能把这个 prop 传给它渲染的元素；写进对象再展开的由 security/raw-html 查。
      "react/no-danger": ["error", { customComponentNames: ["*"] }],
      "security/raw-html": "error",
      "no-script-url": "error",
    },
  },
  {
    // Next 在应用进程里加载的根目录文件也是应用代码，但不在「Layers」表的目录里，单独列出。
    files: [`{proxy,instrumentation}.${extensionGlob}`],
    rules: { "no-restricted-syntax": ["error", ...RESTRICTED_SYNTAX] },
  },
  {
    // 封装 Base UI 的地方，可以渲染 NATIVE_ELEMENTS 里的原生元素。
    files: ["components/ui/**"],
    ignores: APPLICATION_CODE.ignores,
    rules: { "no-restricted-syntax": restrictedSyntaxWithout(NATIVE_ELEMENTS) },
  },
  // 组件入口在所在位置的限制之外，禁止 export * 和 export * as，要求显式列出公开成员。
  ...[
    [`**/components/!(ui)/index.${extensionGlob}`, RESTRICTED_SYNTAX],
    [`**/_components/*/index.${extensionGlob}`, RESTRICTED_SYNTAX],
    [
      `**/components/ui/*/index.${extensionGlob}`,
      RESTRICTED_SYNTAX.filter(
        (restriction) => !NATIVE_ELEMENTS.includes(restriction),
      ),
    ],
  ].map(([files, restrictions]) => ({
    files: [files],
    rules: {
      // 追踪导入的 namespace 及其 const 别名，避免入口间接暴露整个命名空间。
      "architecture/component-exports": "error",
      "no-restricted-syntax": [
        "error",
        ...restrictions,
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
  })),
  // ---- i18n（.claude/rules/i18n.md）----
  // - i18next/no-literal-string：用户看得到的文案放进 messages/，用 t() 渲染。
  // - i18n/client-namespaces：每个 ClientMessages 下发的 namespace 和它包着的 Client Component 用到的一致。
  // - i18n/message-keys：每个 key 的第一段是文件 owner 的 namespace。
  // - TRANSLATOR_NAMESPACE：翻译函数不按 namespace 取，随 RESTRICTED_SYNTAX 生效，没有例外。
  // - INTL_PROVIDER_RESTRICTION、DATE_TIME_FORMATTING：前面随 RESTRICTED_IMPORTS、RESTRICTED_SYNTAX 生效，
  //   这里只放它们的例外，所以这一段要排在设置那两条规则的配置之后。
  {
    // 只查 JSX 里的文本和下面这些属性，JSX 之外的文案（toast、metadata、常量里的标签）由 rule 约束。
    // 各组件的 *-examples/ 目录保留字面量：example 和 playground 要能单独复制，控件标签是 prop 名，
    // 组件 metadata 由生成脚本直接读取字面值。
    files: ["{app,features,components}/**/*.{jsx,tsx}"],
    ignores: [
      "features/ui-catalog/components/*-examples/**",
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
      "i18n/message-keys": "error",
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
      "@tanstack/query/api-file-factories": "error",
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
  {
    // feature 依赖图和代码对照：图里的节点对应 features/ 下的目录，每条边在代码里都有依赖。
    files: ["docs/features.md"],
    plugins: { markdown, architecture: architecturePlugin },
    language: "markdown/gfm",
    rules: { "architecture/feature-graph": "error" },
  },
  {
    files: AGENT_INSTRUCTIONS,
    plugins: { markdown, "writing-style": writingStylePlugin },
    language: "markdown/gfm",
    languageOptions: { frontmatter: "yaml" },
    rules: { "writing-style/english-only": "error" },
  },
  // 项目级忽略项在 Next 默认项上加入 worktree，避免重复检查其他 checkout。
  globalIgnores([
    // 保留 Next 默认排除的构建产物与生成类型；.next-e2e 是 e2e 的产物目录（scripts/build-dirs.mjs）。
    ...BUILD_DIRS.map((dir) => `${dir}/**`),
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code 把 worktree 建在仓库内；每个 worktree 在自己的 checkout 里 lint。
    ".claude/worktrees/**",
  ]),
  ...projectConfig,
  // 放在所有规则之后，关闭与 Prettier 重叠或冲突的格式规则。
  eslintConfigPrettier,
]);

export default eslintConfig;
