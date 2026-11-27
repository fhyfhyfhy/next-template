import { existsSync, readFileSync } from "node:fs";
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
import { getDefaultSelectors } from "eslint-plugin-better-tailwindcss/defaults";
import i18next from "eslint-plugin-i18next";
import playwright from "eslint-plugin-playwright";
import simpleImportSort from "eslint-plugin-simple-import-sort";

import { BUILD_DIRS } from "./scripts/build-dirs.mjs";
import createNamingPlugin from "./scripts/eslint/architecture/naming-plugin.mjs";
import createArchitecturePlugin, {
  layerZones,
} from "./scripts/eslint/architecture/plugin.mjs";
import createDataFlowPlugin from "./scripts/eslint/data/data-flow-plugin.mjs";
import withWrapperImports, {
  apiFileFactoriesRule,
  mutationCallbacksRule,
} from "./scripts/eslint/data/query-plugin.mjs";
import createDocsPlugin from "./scripts/eslint/docs-plugin.mjs";
import e2ePlugin from "./scripts/eslint/e2e-plugin.mjs";
import createI18nPlugin from "./scripts/eslint/i18n-plugin.mjs";
import { SOURCE_EXTENSIONS, SOURCE_GLOB } from "./scripts/eslint/imports.mjs";
import {
  FEATURE_LAYERS,
  ROOT_APP_FILES,
  ROOT_DIRECTORIES,
  ROOT_LAYERS,
} from "./scripts/eslint/layers.mjs";
import securityPlugin, {
  SECURITY_RULES,
} from "./scripts/eslint/security-plugin.mjs";
import { TAILWIND_CLASS_RESTRICTIONS } from "./scripts/eslint/tailwind-classes.mjs";
import writingStylePlugin from "./scripts/eslint/writing-style-plugin.mjs";

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

// ---- 架构（.claude/rules/architecture.md）的常量，规则配置在下面配置数组的「架构」一段，层级表在
// scripts/eslint/layers.mjs ----

// 几个配置对象共用一个实例：同名插件在两个配置对象里必须是同一个对象。
const architecturePlugin = createArchitecturePlugin(PROJECT_ROOT);

// 只有 lib/ 和 feature 的 server/ 能引用的数据库入口：连接模块（项目根目录下的路径，不带扩展名）和数据库
// 客户端的包。由 architecture/data-access 检查，对应 .claude/rules/architecture.md「Feature structure」。
const DATABASE_ACCESS = { modules: ["lib/db"], packages: ["pg", "kysely"] };

const COMPONENT_INDEX_EXPORT_MESSAGE =
  "List public API members explicitly in the component entry. Use named exports instead of export * or namespace re-exports.";

// ---- 架构的常量结束 ----

// ---- 数据（.claude/rules/ 的 data-flow.md、server-data.md、data-setup.md、tanstack-query.md，AGENTS.md「Environment variables」）的常量，规则配置在下面配置数组的「数据」一段 ----
// 数据借用 no-restricted-imports、no-restricted-syntax 的各一组限制。这两条规则还管着别的事，所以这两组合进
// 下面的 RESTRICTED_IMPORTS 和 RESTRICTED_SYNTAX；数据的其余检查和 ENV_ACCESS 的例外在配置数组的「数据」一段。

// TanStack 官方规则和本地规则合成一个插件，规则名统一用官方的前缀 @tanstack/query/*。
// withWrapperImports 让官方规则识别从 @/lib/react-query 封装的 import。
const tanstackQueryPlugin = withWrapperImports(pluginQuery);
tanstackQueryPlugin.rules["mutation-callbacks"] = mutationCallbacksRule;
tanstackQueryPlugin.rules["api-file-factories"] = apiFileFactoriesRule;

// 避免另起 axios/SWR 数据通路，统一使用项目的 fetchApi 和 React Query。
const QUERY_LIBRARY_MESSAGE =
  "Request server data with fetchApi from @/lib/request/fetch and React Query from @/lib/react-query. See .claude/rules/data-flow.md.";
const QUERY_LIBRARY_RESTRICTION = {
  paths: ["axios", "swr"].map((name) => ({
    name,
    message: QUERY_LIBRARY_MESSAGE,
  })),
  patterns: [{ group: ["axios/*", "swr/*"], message: QUERY_LIBRARY_MESSAGE }],
};

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

// ---- 数据的常量结束 ----

// ---- UI（.claude/rules/ 的 components.md、design-system.md、react.md、ui-catalog.md）的常量，规则配置在下面配置数组的「UI」一段 ----
// NATIVE_ELEMENTS 和 NESTED_INTERACTIVE 借用 no-restricted-syntax。这条规则还管着别的事，所以这两组合进下面的
// RESTRICTED_SYNTAX；NATIVE_ELEMENTS 的例外和 UI 的其余检查在配置数组的「UI」一段。

// Base UI 有对应组件的原生元素和带控件 role 的元素只在 components/ui/ 的封装里渲染，别处渲染封装，样式、状态和
// 可访问性才一致。选择器只匹配小写的原生标签和字符串字面量的 role（`role="button"` 或 `role={"button"}`）：
// <Form>、<form.Field> 这类组件和成员表达式不受影响。
const nativeElement = (element, replacement, condition = "") => ({
  selector: `JSXOpeningElement[name.name='${element}']${condition}`,
  message: `Native <${element}> renders only inside components/ui/: use ${replacement}. See "Wrap a UI library" in .claude/rules/design-system.md.`,
});
const CONTROL_ROLE =
  "/^(button|checkbox|switch|radio|radiogroup|slider|spinbutton|textbox|combobox|listbox|option|menu|menuitem|tab|tablist|tooltip|dialog|alertdialog|progressbar|meter|separator)$/";
const NATIVE_ELEMENTS = [
  nativeElement("button", "Button from @/components/ui/button"),
  // Base UI 没有文件选择和隐藏字段的组件，这两种 input 保持原生。
  nativeElement(
    "input",
    "Input, Checkbox, Switch, or the RadioGroup parts from @/components/ui/; a range input takes a wrapper of Base UI's Slider in components/ui/, adding it first if it is missing",
    ":not(:has(> JSXAttribute[name.name='type']:matches([value.value=/^(file|hidden)$/], [value.expression.value=/^(file|hidden)$/])))",
  ),
  // Base UI 没有多行输入的组件，textarea 由 components/ui/textarea.tsx 用 Field.Control 封装。
  nativeElement("textarea", "Textarea from @/components/ui/textarea"),
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
  {
    selector: `JSXAttribute[name.name='role']:matches([value.value=${CONTROL_ROLE}], [value.expression.value=${CONTROL_ROLE}])`,
    message:
      'A control role, such as role="button", renders only inside components/ui/: render the component from @/components/ui/ that has it, or a wrapper of the matching Base UI component, adding it first if it is missing. See "Wrap a UI library" in .claude/rules/design-system.md.',
  },
];

// 一个触发器或控件只有一个可交互元素。按名字认父元素，只看直接子元素，间接的嵌套由
// docs/agents/code-review.md「UI」一节的 review 看。不放进 NATIVE_ELEMENTS：components/ui/ 里同样生效。Base UI 的
// Button 不渲染链接，出自 node_modules/@base-ui/react/docs/react/components/button.md 的「Rendering links as buttons」。
const NESTED_LINK_MESSAGE =
  'Give a link one interactive element: render the link alone, neither inside a button or link nor holding one, with buttonVariants from @/components/ui/button as its className when it should look like a button, as in <Link href="/tasks" className={buttonVariants({ variant: "outline" })}>. Next\'s Link and <a> take no render prop, and Base UI\'s Button gives what it renders button semantics, so it never renders a link. See "Use a component" in .claude/rules/components.md.';
const NESTED_INTERACTIVE = [
  {
    selector:
      "JSXElement[openingElement.name.name=/(Trigger|Close|Button)$|^button$/] > JSXElement[openingElement.name.name=/^(Button|button)$/]",
    message:
      'Give a trigger or control one interactive element: render one button, passing the inner Button as the outer component\'s render prop instead of nesting it, as in <DialogTrigger render={<Button variant="ghost" />}>. See "Use a component" in .claude/rules/components.md.',
  },
  {
    selector:
      "JSXElement[openingElement.name.name=/(Trigger|Close|Button|Link)$|^(a|button)$/] > JSXElement[openingElement.name.name=/^(Link|a)$/]",
    message: NESTED_LINK_MESSAGE,
  },
  {
    selector:
      "JSXElement[openingElement.name.name=/Link$|^a$/] > JSXElement[openingElement.name.name=/^(Button|button)$/]",
    message: NESTED_LINK_MESSAGE,
  },
];

const CATALOG_RELATIVE_IMPORT_MESSAGE =
  "A UI catalog playground or example is copied on its own: import through @/ or a package, not a relative path.";

// ---- UI 的常量结束 ----

// ---- i18n（.claude/rules/i18n.md）的常量，规则配置在下面配置数组的「i18n」一段 ----
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
// toLocaleString 看不出调用的是 Date 还是数字，所以消息两种都说。
const LOCALE_STRING_MESSAGE =
  "Show a date or time with <DateTime> from @/components/date-time, and a number with next-intl's useFormatter() or getFormatter(): toLocaleString formats in the runtime's locale and time zone, which differ between the server and the browser. See .claude/rules/i18n.md.";
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
  {
    selector:
      "CallExpression[callee.property.name=/^to(Locale)?(Date|Time)String$/]",
    message: DATE_TIME_MESSAGE,
  },
  {
    selector: "CallExpression[callee.property.name='toLocaleString']",
    message: LOCALE_STRING_MESSAGE,
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

// ---- i18n 的常量结束 ----

// agent 读的指令，用英文写。和 .claude/rules/writing-style.md「Language by content」表里 Agent instructions
// 一行对应，改一边要同步另一边。
const AGENT_INSTRUCTIONS = [
  "AGENTS.md",
  "CLAUDE.md",
  ".claude/rules/**/*.md",
  ".agents/**/*.md",
  "docs/agents/**/*.md",
];

// 检查相对链接和指向 template GitHub 的链接的文档。第三方 skill（skills-lock.json）是上游原文加上 patch，链接和引用
// 不查，SKILL.md 的 frontmatter 照查（见 docs/frontmatter 那一段）；它们的 patch 在 .agents/skill-patches/，属于
// agent 指令。
const DOCS = [
  "AGENTS.md",
  "README.md",
  "GLOSSARY.md",
  "docs/**/*.md",
  ".claude/rules/**/*.md",
  ".agents/skills/**/*.md",
];
const THIRD_PARTY_SKILLS = Object.keys(
  JSON.parse(readFileSync(join(PROJECT_ROOT, "skills-lock.json"), "utf8"))
    .skills,
).map((name) => `.agents/skills/${name}/**`);
const docsPlugin = createDocsPlugin(PROJECT_ROOT);

// 所有代码都受的 no-restricted-imports 限制。
const RESTRICTED_IMPORTS = {
  paths: [...QUERY_LIBRARY_RESTRICTION.paths, INTL_PROVIDER_RESTRICTION],
  patterns: QUERY_LIBRARY_RESTRICTION.patterns,
};

// 所有应用代码都受的 no-restricted-syntax 限制。
const RESTRICTED_SYNTAX = [
  ...DATE_TIME_FORMATTING,
  ...TRANSLATOR_NAMESPACE,
  ...ENV_ACCESS,
  ...NATIVE_ELEMENTS,
  ...NESTED_INTERACTIVE,
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
  files: ROOT_DIRECTORIES.map(({ name }) => `${name}**/*.${extensionGlob}`),
  ignores: [`**/*.{test,spec}.${extensionGlob}`],
};

// 派生项目自己的检查和忽略项写在 eslint.config.project.mjs（.agents/skills/derived-project/SKILL.md），它导出的
// 配置接在 template 的规则后面、Prettier 之前；没有这个文件时只用 template 的配置。项目的限制写成自己插件里的独立
// 规则：在那里给文件设置 no-restricted-imports 或 no-restricted-syntax，会整个替换下面给同一批文件设的选项。
// 追加 Tailwind class 的限制见 scripts/eslint/tailwind-classes.mjs 的 TAILWIND_CLASS_RESTRICTIONS；项目自己封装的 UI 库
// 用 architecture/wrapper-imports 的 uiLibraries 选项追加，files 取 scripts/eslint/imports.mjs 的 SOURCE_GLOB，和下面
// 设这条规则的范围一致。template 已有的东西从它的模块取，不要复制：template 升级改了那里，复制的那份不会跟着变。应用代码的目录取自
// scripts/eslint/layers.mjs，给更多文件开的安全规则取自 security-plugin.mjs 的 SECURITY_RULES，判断中日韩文字的
// 字符集取自 writing-style-plugin.mjs 的 CJK。
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
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      // 按 importGroups 固定顺序并支持自动修复，减少增删依赖时无关的排序 diff。
      "simple-import-sort/imports": ["error", { groups: importGroups }],
      "no-restricted-imports": ["error", RESTRICTED_IMPORTS],
    },
  },
  {
    ...APPLICATION_CODE,
    plugins: { security: securityPlugin },
    rules: {
      "no-restricted-syntax": ["error", ...RESTRICTED_SYNTAX],
      ...SECURITY_RULES,
    },
  },
  {
    files: ROOT_APP_FILES,
    rules: { "no-restricted-syntax": ["error", ...RESTRICTED_SYNTAX] },
  },
  // ---- UI（.claude/rules/ 的 components.md、design-system.md、react.md、ui-catalog.md）----
  // - NATIVE_ELEMENTS 前面随 RESTRICTED_SYNTAX 生效，这里只放它的例外。所以这一段要排在设置 no-restricted-syntax 的配置之后、
  //   「架构」一段之前：那一段的组件入口配置给 components/ui/ 的 index 重设这条规则，例外排在它后面会把入口的限制整个替换掉。
  // - React Hooks 和 jsx-a11y 的 ARIA 检查来自最前面的 nextVitals；下面把其中设为 warn 的提成 error，另加三条拦手写的
  //   可点击元素。
  // - 组件目录的入口和引用（architecture/component-*）、组件和 UI catalog 示例目录的对应（architecture/catalog-examples）、
  //   UI 库只经封装引入（architecture/wrapper-imports）在「架构」一段。
  {
    // 生成器按码点排序 import，插件不是（node_modules/eslint-plugin-simple-import-sort/shared.js 的 getSource、compare）：
    // 它先把路径里的 . 和 / 改写成排在 - 和 _ 之前，所以一个示例 ID 是另一个的前缀时（select、select-all）顺序不同；
    // 再用不分大小写、按数值比较数字的 Intl.Collator，所以图标名的顺序也不同（IconArrowUp 和 IconArrowsDiagonal、
    // IconBadge2 和 IconBadge10）。lint-staged 的 --fix 改完，下次生成又改回去，所以顺序以生成器为准。
    files: ["features/ui-catalog/**/*.generated.ts"],
    rules: { "simple-import-sort/imports": "off" },
  },
  {
    // 封装 Base UI 的地方，可以渲染 NATIVE_ELEMENTS 里的原生元素和控件 role。
    files: ["components/ui/**"],
    ignores: APPLICATION_CODE.ignores,
    rules: { "no-restricted-syntax": restrictedSyntaxWithout(NATIVE_ELEMENTS) },
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
    rules: {
      // nextVitals 把这几条设为 warn，而 lint 和 lint-staged 都不因 warning 失败。只设级别，沿用 nextVitals 的选项。
      ...Object.fromEntries(
        [
          "jsx-a11y/alt-text",
          "jsx-a11y/aria-props",
          "jsx-a11y/aria-proptypes",
          "jsx-a11y/aria-unsupported-elements",
          "jsx-a11y/role-has-required-aria-props",
          "jsx-a11y/role-supports-aria-props",
          "react-hooks/exhaustive-deps",
          "react-hooks/incompatible-library",
          "react-hooks/unsupported-syntax",
        ].map((rule) => [rule, "error"]),
      ),
      // 关掉这两条的组件和 hook，React Compiler 不编译。
      "@eslint-community/eslint-comments/no-restricted-disable": [
        "error",
        "react-hooks/rules-of-hooks",
        "react-hooks/exhaustive-deps",
      ],
      // 给 div、li 加点击处理的写法拦下，改用 Button 或 Link。
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
    },
  },
  {
    files: [SOURCE_GLOB],
    // 测试里的 class 是 cn() 等函数的输入，不会渲染，会故意拼接或写成非规范形式。
    ignores: [`**/*.{test,spec}.${extensionGlob}`],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": {
        // 插件按 ESLint 的 cwd 解析 tailwindcss 和 entryPoint：从子目录或 monorepo 根运行时不设它，主题 class 全报
        // unknown，或者整组规则静默关掉。entryPoint 相对这里解析。
        cwd: PROJECT_ROOT,
        entryPoint: "app/globals.css",
        // 不设时插件不做 px 到 rem 的换算，lg:max-h-[520px] 这类可以写成 lg:max-h-130 的 class 就查不出来。
        // globals.css 没有改根字号，按浏览器默认的 16px 算，和 Tailwind CSS IntelliSense 的默认值一致。
        rootFontSize: 16,
        // 插件默认只读 className、cn()/cva() 和名为 className(s)、classes、style(s) 的变量；这里补上存 class 的常量和
        // 查找表、xxxClassName prop、不经 cn() 的函数式 className。别的名字由 docs/agents/code-review.md「UI」一节的
        // review 看。
        selectors: [
          ...getDefaultSelectors(),
          {
            kind: "variable",
            name: "^.*(?:Class(?:Names?|es)?|_CLASS(?:_NAMES?|ES)?)$",
            match: [{ type: "strings" }, { type: "objectValues" }],
          },
          {
            kind: "attribute",
            name: "^.+ClassName$",
            match: [{ type: "strings" }],
          },
          {
            kind: "attribute",
            name: "^class(?:Name)?$",
            match: [
              {
                type: "anonymousFunctionReturn",
                match: [{ type: "strings" }],
              },
            ],
          },
        ],
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
      // 颜色、圆角和过渡的限制，见 scripts/eslint/tailwind-classes.mjs。
      "better-tailwindcss/no-restricted-classes": [
        "error",
        { restrict: TAILWIND_CLASS_RESTRICTIONS },
      ],
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    rules: {
      // 组件写成具名 function 声明（components.md「Public API」）。
      "react/function-component-definition": [
        "error",
        {
          namedComponents: "function-declaration",
          unnamedComponents: ["function-expression", "arrow-function"],
        },
      ],
    },
  },
  {
    files: [`**/{components,_components}/**/*.${extensionGlob}`],
    // 这些目录里没有框架按默认导出加载的文件。
    rules: { "import/no-default-export": "error" },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    ignores: APPLICATION_CODE.ignores,
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
    // UI catalog 把这些文件当作可复制的代码展示（.claude/rules/ui-catalog.md），所以只按包名或 @/ 引用：
    // 相对路径的引用（含副作用导入、动态 import 和 import() 类型）复制出去就解析不了。和下面 e2e/ 一样带上全局的限制。
    files: [
      "features/ui-catalog/components/*-examples/playground.tsx",
      "features/ui-catalog/components/*-examples/*.example.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          ...RESTRICTED_IMPORTS,
          patterns: [
            ...RESTRICTED_IMPORTS.patterns,
            {
              regex: "^\\.\\.?(/|$)",
              message: CATALOG_RELATIVE_IMPORT_MESSAGE,
            },
          ],
        },
      ],
      // no-restricted-imports 不查动态 import 和 import() 类型。
      "no-restricted-syntax": [
        "error",
        ...RESTRICTED_SYNTAX,
        {
          selector:
            ":matches(ImportExpression, TSImportType) > :matches(Literal[value=/^\\.\\.?(\\/|$)/], TemplateLiteral[quasis.0.value.raw=/^\\.\\.?(\\/|$)/])",
          message: CATALOG_RELATIVE_IMPORT_MESSAGE,
        },
      ],
    },
  },
  // ---- UI 结束 ----
  // ---- 架构（.claude/rules/architecture.md）----
  // 组件入口的配置带着 RESTRICTED_SYNTAX 设置 no-restricted-syntax，所以这一段要排在设置这条规则的配置之后。
  {
    files: [SOURCE_GLOB],
    // node_modules 里的包不会反向 import 项目代码，不用解析它们的导出。不忽略的话，import/no-cycle 会逐个解析
    // @tabler/icons-react 的几千个图标模块和 9MB 的 typescript.js，整体 lint 慢 5 倍以上。
    settings: { "import/ignore": ["node_modules"] },
    plugins: {
      architecture: architecturePlugin,
      naming: createNamingPlugin(PROJECT_ROOT),
    },
    rules: {
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
              from: ROOT_DIRECTORIES.flatMap((layer) => layer.files),
              message:
                "e2e/ observes the app through the browser and writes its test data straight to the e2e database, so it imports no application code. See .claude/rules/e2e.md.",
            },
          ],
        },
      ],
      // 检查可解析的文件依赖环，忽略纯类型导入；跨 feature 的聚合循环由专用规则检查。
      "import/no-cycle": ["error", { commonjs: true }],
      // 按 feature 聚合依赖（含类型引用），捕获文件图无环但 feature 之间互相依赖的情况。
      "architecture/no-feature-cycle": "error",
      // feature 之间的每个依赖（含类型引用）都要在 docs/features.md 的依赖图里有对应的边。
      "architecture/feature-dependencies": "error",
      // feature 内部用相对路径且不反向引用自身公共入口。
      // 跨边界用 @/；访问其他 feature 时只走公共入口。
      "architecture/feature-imports": "error",
      // 组件目录内用相对路径，对外只开放 index 入口，避免调用方依赖私有实现路径。
      "architecture/component-imports": "error",
      // 每个组件目录只保留一个实现入口，避免多个 index 扩展名产生解析歧义；允许声明文件并存。
      "architecture/component-entry": "error",
      // components/ui/ 的组件和 UI catalog 的示例目录一一对应。
      "architecture/catalog-examples": "error",
      // React Query、cn 和 UI 库只经项目封装引入：绕过封装会丢掉 QueryClient 策略、按项目主题合并 class，或者项目
      // 统一的样式、默认值和行为。
      "architecture/wrapper-imports": "error",
      // 跨 package 的依赖使用包名，避免相对路径穿透另一个包的边界。
      "import/no-relative-packages": "error",
      // 源码路径统一用 kebab-case，同时保留 Next.js 路由目录的特殊命名约定。
      "naming/kebab-case": "error",
    },
  },
  {
    // 只查应用代码目录：scripts/ 和根目录配置文件不经过 Next.js 打包，解析不了 @/。
    files: ROOT_DIRECTORIES.flatMap((layer) => layer.files),
    rules: {
      // 当前目录及子目录用相对路径，跨目录用 @/；app/ 内部全用相对路径；feature 和组件内部交给各自的规则。
      "architecture/root-imports": "error",
      // app/ 里的 _components/ 在所有使用方所在目录的最近公共祖先里：不被更高的文件引用，也不比需要的更高。
      "architecture/app-component-placement": "error",
      // 项目模块只按它导出的名字引用（CSS 除外），package.json 的 sideEffects 声明才成立。
      "architecture/side-effect-imports": "error",
    },
  },
  {
    // 应用代码（含根目录的 proxy、instrumentation）只经 lib/ 和 feature 的 server/ 访问数据库。
    files: [
      ...ROOT_DIRECTORIES.flatMap((layer) => layer.files),
      ...ROOT_APP_FILES,
    ],
    ignores: ["lib/**", "features/*/server/**"],
    rules: { "architecture/data-access": ["error", DATABASE_ACCESS] },
  },
  // 应用代码里组件目录的入口在所在位置的限制之外，禁止 export * 和 export * as，要求显式列出公开成员。只有根目录的
  // components/ui/ 是组件集合，它的组件入口和那里的其他文件一样豁免 NATIVE_ELEMENTS。
  ...[
    [`components/!(ui)/index.${extensionGlob}`, RESTRICTED_SYNTAX],
    [`features/*/components/*/index.${extensionGlob}`, RESTRICTED_SYNTAX],
    [`app/**/_components/*/index.${extensionGlob}`, RESTRICTED_SYNTAX],
    [
      `components/ui/*/index.${extensionGlob}`,
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
        // export * as 也是 ExportAllDeclaration。
        {
          selector: "ExportAllDeclaration",
          message: COMPONENT_INDEX_EXPORT_MESSAGE,
        },
      ],
    },
  })),
  {
    // feature 依赖图和代码对照：图里的节点对应 features/ 下的目录，每条边在代码里都有依赖。
    files: ["docs/features.md"],
    plugins: { markdown, architecture: architecturePlugin },
    language: "markdown/gfm",
    rules: { "architecture/feature-graph": "error" },
  },
  // ---- 架构结束 ----
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
  // ---- 数据（.claude/rules/ 的 data-flow.md、server-data.md、data-setup.md、tanstack-query.md，AGENTS.md「Environment variables」）----
  // QUERY_LIBRARY_RESTRICTION、ENV_ACCESS 前面随 RESTRICTED_IMPORTS、RESTRICTED_SYNTAX 生效，这里只放 ENV_ACCESS 的例外，
  // 所以这一段要排在设置 no-restricted-syntax 的配置之后。
  {
    files: [SOURCE_GLOB],
    plugins: {
      "data-flow": createDataFlowPlugin(PROJECT_ROOT),
      "@tanstack/query": tanstackQueryPlugin,
    },
    rules: {
      // 服务端代码直接调数据层，不用 fetchApi 或 fetch 请求本 app 自己的接口。
      "data-flow/no-server-self-fetch": "error",
      // 浏览器里的裸 fetch 请求本 app 的路径时拼上 BASE_PATH，fetchApi 会自己加。
      "data-flow/raw-fetch-base-path": "error",
      // feature 的 server/ 和 server.ts 只在服务端运行：import "server-only" 让它们进了浏览器的 bundle 就构建失败。
      "data-flow/server-only": "error",
      // feature 的 api/ 里 -action 文件是 Server Action 模块，以 "use server" 开头。
      "data-flow/action-module": "error",
      // utils/ 里的 -search-params 文件 Server Component 也要用，只从 nuqs/server 引入。
      "data-flow/search-params-imports": "error",
      // feature 的 types/ 里的 schema 只用 JSON 原生的值：不用 z.date()、z.bigint()、.optional()、.transform()。
      "data-flow/json-native-schema": "error",
      // 保留 factory 负责的缓存更新；调用方的成功、失败及结束回调放在 mutate 的第二个参数。
      "@tanstack/query/mutation-callbacks": "error",
    },
  },
  // 复用 TanStack 的严格推荐检查。
  ...pluginQuery.configs["flat/recommended-strict"].map((config) => ({
    ...config,
    files: [SOURCE_GLOB],
    plugins: { "@tanstack/query": tanstackQueryPlugin },
  })),
  {
    files: ["features/*/api/**"],
    rules: {
      // 一个文件一个操作：读的工厂和写的工厂不放在同一个文件里，写的工厂所在的文件 import 它的 Server Action。
      "@tanstack/query/api-file-factories": "error",
    },
  },
  {
    // 唯一读应用环境变量的地方。
    files: ["lib/env.ts"],
    rules: {
      "no-restricted-syntax": restrictedSyntaxWithout(ENV_ACCESS),
    },
  },
  // ---- 数据结束 ----
  // ---- 测试（.claude/rules/ 的 tests.md、e2e.md）----
  // e2e/ 不引入应用代码的检查在「架构」一段，和别的层级边界一起。
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
  // ---- 测试结束 ----
  {
    files: AGENT_INSTRUCTIONS,
    plugins: { markdown, "writing-style": writingStylePlugin },
    language: "markdown/gfm",
    languageOptions: { frontmatter: "yaml" },
    rules: { "writing-style/english-only": "error" },
  },
  // 读 frontmatter 的是 skill 的 SKILL.md（npx skills）和规则（paths）；第三方 skill 也查，patch 会改它们的
  // description。skill 里别的文件的 frontmatter 没有加载器读，不查。
  {
    files: [".agents/skills/*/SKILL.md", ".claude/rules/**/*.md"],
    plugins: { markdown, docs: docsPlugin },
    language: "markdown/gfm",
    languageOptions: { frontmatter: "yaml" },
    rules: { "docs/frontmatter": "error" },
  },
  {
    files: DOCS,
    ignores: THIRD_PARTY_SKILLS,
    plugins: { markdown, docs: docsPlugin },
    language: "markdown/gfm",
    languageOptions: { frontmatter: "yaml" },
    rules: {
      "docs/relative-links": "error",
      "docs/template-links": "error",
    },
  },
  {
    files: AGENT_INSTRUCTIONS,
    ignores: THIRD_PARTY_SKILLS,
    plugins: { markdown, docs: docsPlugin },
    language: "markdown/gfm",
    languageOptions: { frontmatter: "yaml" },
    rules: {
      "docs/sample-product-paths": "error",
      "docs/people-docs": "error",
    },
  },
  {
    files: ["docs/agents/code-review.md"],
    plugins: { markdown, docs: docsPlugin },
    language: "markdown/gfm",
    rules: { "docs/code-references": "error" },
  },
  {
    // ESLint 消息里用 See "小节" in <文件> 指向规则的写法。
    files: ["eslint.config.mjs", "scripts/eslint/**/*.mjs"],
    ignores: ["**/*.test.mjs"],
    plugins: { docs: docsPlugin },
    rules: { "docs/section-pointers": "error" },
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
