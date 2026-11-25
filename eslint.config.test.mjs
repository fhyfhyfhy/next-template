import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const project = dirname(fileURLToPath(import.meta.url));

const featureRule = "architecture/feature-imports";
const componentRule = "architecture/component-imports";
const componentEntryRule = "architecture/component-entry";
const componentExportsRule = "architecture/component-exports";
const wrapperRule = "architecture/wrapper-imports";
const rootRule = "architecture/root-imports";
const placementRule = "architecture/app-component-placement";
const namingRule = "naming/kebab-case";
const cases = [];
const statements = {
  import: (source) =>
    `import { value } from "${source}"; export const result = value;`,
  dynamic: (source) => `export const result = import("${source}");`,
  dynamicTemplate: (source) => `export const result = import(\`${source}\`);`,
  reexport: (source) => `export { value } from "${source}";`,
  exportAll: (source) => `export * from "${source}";`,
  importType: (source) =>
    `import type { Item } from "${source}"; export type Result = Item;`,
  tsImportType: (source) => `export type Result = import("${source}").Item;`,
  require: (source) =>
    `/* eslint-disable @typescript-eslint/no-require-imports -- 用例检查 require 写法的依赖 */\nexport const result = require("${source}");`,
  importEquals: (source) =>
    `/* eslint-disable @typescript-eslint/no-require-imports -- 用例检查 require 写法的依赖 */\nimport result = require("${source}"); export { result };`,
};

function addCase(
  name,
  {
    from = "features/CASE/components/main.ts",
    to,
    source,
    syntax = "import",
    rule,
    messageId,
    message,
  },
) {
  const id = `case-${cases.length}`;
  const expand = (value) => value.replaceAll("CASE", id);
  cases.push({
    name,
    from: expand(from),
    files: {
      ...(to
        ? {
            [expand(to)]:
              "export const value = 1; export type Item = { value: number };",
          }
        : {}),
      [expand(from)]: statements[syntax](expand(source)),
    },
    rules: rule ? [rule] : [],
    messageIds: messageId ? [messageId] : undefined,
    messages: message ? [message] : undefined,
  });
}

addCase("同一 feature 的别名导入被拒绝", {
  to: "features/CASE/hooks/value.ts",
  source: "@/features/CASE/hooks/value",
  rule: featureRule,
});
addCase("内部实现不能通过别名引用自身 feature 根入口", {
  to: "features/CASE/index.ts",
  source: "@/features/CASE",
  rule: featureRule,
  messageId: "selfEntry",
});
addCase("别名中的 .. 不能绕过同 feature 检查", {
  to: "features/CASE/hooks/value.ts",
  source: "@/features/CASE/../CASE/hooks/value",
  rule: featureRule,
});
addCase("同一 feature 内可以相对导入下层", {
  to: "features/CASE/hooks/value.ts",
  source: "../hooks/value",
});
addCase("同一 feature 内可以相对导入同层", {
  from: "features/CASE/hooks/main.ts",
  to: "features/CASE/hooks/value.ts",
  source: "./value",
});
addCase("不能用相对路径导入另一个 feature", {
  to: "features/CASE-other/index.ts",
  source: "../../CASE-other",
  rule: featureRule,
});
addCase("feature 导入根目录 lib 必须使用别名", {
  to: "lib/CASE.ts",
  source: "../../../lib/CASE",
  rule: featureRule,
});
addCase("app 导入 feature 必须使用别名", {
  from: "app/CASE.ts",
  to: "features/CASE/index.ts",
  source: "../features/CASE",
  rule: featureRule,
});
addCase("feature 可以通过别名导入根目录 lib", {
  to: "lib/CASE.ts",
  source: "@/lib/CASE",
});
addCase("feature 可以通过别名导入另一个 feature 的主入口", {
  to: "features/CASE-other/index.ts",
  source: "@/features/CASE-other",
});
addCase("feature 可以通过别名导入另一个 feature 的子入口", {
  to: "features/CASE-other/canvas.ts",
  source: "@/features/CASE-other/canvas",
});
addCase("第三方包名不受 feature 路径规则限制", {
  source: "react",
  syntax: "exportAll",
});

for (const syntax of [
  "dynamic",
  "reexport",
  "exportAll",
  "importType",
  "tsImportType",
]) {
  addCase(`${syntax} 拒绝同 feature 别名`, {
    to: "features/CASE/hooks/value.ts",
    source: "@/features/CASE/hooks/value",
    syntax,
    rule: featureRule,
  });
  addCase(`${syntax} 允许同 feature 相对路径`, {
    to: "features/CASE/hooks/value.ts",
    source: "../hooks/value",
    syntax,
  });
  addCase(`${syntax} 拒绝跨 feature 相对路径`, {
    to: "features/CASE-other/index.ts",
    source: "../../CASE-other",
    syntax,
    rule: featureRule,
  });
}

for (const syntax of ["import", "dynamic"]) {
  addCase(`${syntax} 不能访问另一个 feature 的私有文件`, {
    to: "features/CASE-other/hooks/private.ts",
    source: "@/features/CASE-other/hooks/private",
    syntax,
    rule: featureRule,
  });
  addCase(`${syntax} 不能把内部目录 barrel 当成公开子入口`, {
    to: "features/CASE-other/hooks/index.ts",
    source: "@/features/CASE-other/hooks",
    syntax,
    rule: featureRule,
  });
}

cases.push({
  name: "根子入口文件优先于同名内部目录",
  from: "app/sub-entry-with-directory.ts",
  files: {
    "features/sub-entry-with-directory/canvas.ts": "export const value = 1;",
    "features/sub-entry-with-directory/canvas/index.ts":
      "export const privateValue = 2;",
    "app/sub-entry-with-directory.ts": statements.import(
      "@/features/sub-entry-with-directory/canvas",
    ),
  },
  rules: [],
});

addCase("根目录同层依赖允许", {
  from: "lib/CASE-main.ts",
  to: "lib/CASE-value.ts",
  source: "./CASE-value",
});
addCase("根目录下层依赖允许", {
  from: "hooks/CASE.ts",
  to: "lib/CASE.ts",
  source: "@/lib/CASE",
});
addCase("components/ui 可以依赖下层 hooks", {
  from: "components/ui/CASE.ts",
  to: "hooks/CASE.ts",
  source: "@/hooks/CASE",
});
addCase("components/ui 不能引用 components/ 的单文件组件", {
  from: "components/ui/CASE.ts",
  to: "components/CASE-panel.ts",
  source: "@/components/CASE-panel",
  rule: "import/no-restricted-paths",
});
addCase("components/ui 的组件目录不能引用 components/ 的组件目录", {
  from: "components/ui/CASE/root.ts",
  to: "components/CASE-panel/index.ts",
  source: "@/components/CASE-panel",
  rule: "import/no-restricted-paths",
});
addCase("根目录反向依赖仍然禁止", {
  from: "utils/CASE.ts",
  to: "lib/CASE.ts",
  source: "@/lib/CASE",
  rule: "import/no-restricted-paths",
});
addCase("e2e 不能相对导入应用代码", {
  from: "e2e/CASE.spec.ts",
  to: "lib/CASE.ts",
  source: "../lib/CASE",
  rule: "import/no-restricted-paths",
});
addCase("e2e 不能通过别名导入 feature 入口", {
  from: "e2e/CASE.spec.ts",
  to: "features/CASE/index.ts",
  source: "@/features/CASE",
  rule: "import/no-restricted-paths",
});
addCase("e2e 内部可以相对导入辅助模块", {
  from: "e2e/CASE.spec.ts",
  to: "e2e/CASE-helper.ts",
  source: "./CASE-helper",
});
addCase("feature 内部反向依赖仍然禁止", {
  from: "features/CASE/hooks/main.ts",
  to: "features/CASE/components/value.ts",
  source: "../components/value",
  rule: "import/no-restricted-paths",
});
addCase("feature 的 api 层可以导入它下面的 server 层", {
  from: "features/CASE/api/create-thing-action.ts",
  to: "features/CASE/server/things.ts",
  source: "../server/things",
});
addCase("feature 的 server 层可以导入它下面的 utils 和 types", {
  from: "features/CASE/server/things.ts",
  to: "features/CASE/utils/rules.ts",
  source: "../utils/rules",
});
addCase("feature 的 server 层不能反过来导入 api 层", {
  from: "features/CASE/server/things.ts",
  to: "features/CASE/api/get-things.ts",
  source: "../api/get-things",
  rule: "import/no-restricted-paths",
});
addCase("feature 的 utils 层不能导入 server 层", {
  from: "features/CASE/utils/rules.ts",
  to: "features/CASE/server/things.ts",
  source: "../server/things",
  rule: "import/no-restricted-paths",
});
addCase("feature 的 types 可以导入同层的 constants", {
  from: "features/CASE/types/thing.ts",
  to: "features/CASE/constants/limits.ts",
  source: "../constants/limits",
});
addCase("feature 的 constants 可以导入同层的 utils", {
  from: "features/CASE/constants/limits.ts",
  to: "features/CASE/utils/rules.ts",
  source: "../utils/rules",
});
addCase("根目录的 types 可以导入同层的 utils", {
  from: "types/CASE.ts",
  to: "utils/CASE.ts",
  source: "@/utils/CASE",
});
cases.push({
  name: "同层的 types 和 constants 之间，文件的值导入循环仍然禁止",
  from: "features/leaf-cycle/types/thing.ts",
  files: {
    "features/leaf-cycle/types/thing.ts":
      'import { limit } from "../constants/limits"; export const thing = () => limit;',
    "features/leaf-cycle/constants/limits.ts":
      'import { thing } from "../types/thing"; export const limit = () => thing;',
  },
  rules: ["import/no-cycle"],
});
cases.push({
  name: "同层文件之间的值导入循环仍然禁止",
  from: "lib/cycle/main.ts",
  files: {
    "lib/cycle/main.ts":
      'import { peer } from "./peer"; export const value = () => peer;',
    "lib/cycle/peer.ts":
      'import { value } from "./main"; export const peer = () => value;',
  },
  rules: ["import/no-cycle"],
});

for (const syntax of ["import", "importType"]) {
  const first = `feature-cycle-${syntax.toLowerCase()}-a`;
  const second = `feature-cycle-${syntax.toLowerCase()}-b`;
  const entry = "export const value = 1; export type Item = { value: number };";
  cases.push({
    name: `${syntax} 文件图无环时仍拒绝 feature 循环`,
    from: `features/${first}/components/consumer.ts`,
    files: {
      [`features/${first}/index.ts`]: entry,
      [`features/${second}/index.ts`]: entry,
      [`features/${first}/components/consumer.ts`]: statements[syntax](
        `@/features/${second}`,
      ),
      [`features/${second}/components/consumer.ts`]: statements[syntax](
        `@/features/${first}`,
      ),
    },
    rules: ["architecture/no-feature-cycle"],
    messageIds: ["cycle"],
  });
}

addCase("根组件目录的私有文件不能通过别名直接访问", {
  from: "app/CASE.ts",
  to: "components/CASE/private.ts",
  source: "@/components/CASE/private",
  rule: componentRule,
});
addCase("相对路径不能绕过组件私有边界", {
  from: "features/CASE/components/other/index.ts",
  to: "features/CASE/components/panel/private.ts",
  source: "../panel/private",
  rule: componentRule,
});
addCase("动态导入不能访问 UI 组件私有文件", {
  from: "app/CASE.ts",
  to: "components/ui/CASE/private.ts",
  source: "@/components/ui/CASE/private",
  syntax: "dynamic",
  rule: componentRule,
});
addCase("转导出不能访问组件私有文件", {
  from: "app/CASE.ts",
  to: "components/CASE/private.ts",
  source: "@/components/CASE/private",
  syntax: "reexport",
  rule: componentRule,
});
for (const syntax of ["importType", "tsImportType"]) {
  addCase(`${syntax} 不能访问同 feature 其他组件的私有类型`, {
    from: "features/CASE/components/consumer/main.ts",
    to: "features/CASE/components/widget/private.ts",
    source: "../widget/private",
    syntax,
    rule: componentRule,
  });
}
addCase("feature 根入口不能直接转导出组件私有文件", {
  from: "features/CASE/index.ts",
  to: "features/CASE/components/widget/private.ts",
  source: "./components/widget/private",
  syntax: "reexport",
  rule: componentRule,
});
addCase("只有根目录的 components/ui/ 是组件集合，feature 里的 ui/ 是组件目录", {
  from: "features/CASE/components/consumer.ts",
  to: "features/CASE/components/ui/helper.ts",
  source: "./ui/helper",
  rule: componentRule,
});
addCase("app 内组件目录同样具有私有边界", {
  from: "app/CASE/page.tsx",
  to: "app/CASE/_components/widget/private.ts",
  source: "./_components/widget/private",
  rule: componentRule,
});

for (const directory of [
  "components/CASE",
  "components/ui/CASE",
  "features/CASE/components/widget",
]) {
  addCase(`${directory} 内部可以相对导入自己的私有文件`, {
    from: `${directory}/main.ts`,
    to: `${directory}/internal/value.ts`,
    source: "./internal/value",
  });
}
addCase("组件目录隐式 index.ts 是公开入口", {
  from: "app/CASE.ts",
  to: "components/CASE/index.ts",
  source: "@/components/CASE",
});
addCase("组件目录显式 index.tsx 是公开入口", {
  from: "app/CASE.ts",
  to: "components/CASE/index.tsx",
  source: "@/components/CASE/index.tsx",
});
addCase("组件目录只有类型声明的 index.d.ts 时，它也是公开入口", {
  to: "components/CASE/index.d.ts",
  source: "@/components/CASE",
});
addCase("UI 组件目录隐式 index.tsx 是公开入口", {
  from: "app/CASE.ts",
  to: "components/ui/CASE/index.tsx",
  source: "@/components/ui/CASE",
});
addCase("feature 根入口可以转导出复合组件的公开入口", {
  from: "features/CASE/index.ts",
  to: "features/CASE/components/widget/index.tsx",
  source: "./components/widget",
  syntax: "reexport",
});
addCase("单文件组件不被误当成私有文件", {
  from: "app/CASE.ts",
  to: "components/CASE.tsx",
  source: "@/components/CASE",
});

for (const extension of ["ts", "tsx"]) {
  const component = `components/compound-${extension}`;
  cases.push({
    name: `复合组件 index.${extension} 允许多个具名导出及类型导出`,
    from: `${component}/index.${extension}`,
    files: {
      [`${component}/parts.ts`]:
        "export const Root = 1; export const Trigger = 2; export const Content = 3; export type Props = { value: number };",
      [`${component}/index.${extension}`]:
        'import { Content } from "./parts"; export { Content }; export { Root, Trigger } from "./parts"; export type { Props } from "./parts";',
    },
    rules: [],
  });
  for (const [syntax, statement] of [
    ["star", 'export * from "./parts";'],
    ["namespace", 'export * as Parts from "./parts";'],
  ]) {
    const component = `components/compound-${extension}-${syntax}`;
    cases.push({
      name: `复合组件 index.${extension} 禁止 ${syntax} 转导出`,
      from: `${component}/index.${extension}`,
      files: {
        [`${component}/parts.ts`]: "export const Root = 1;",
        [`${component}/index.${extension}`]: statement,
      },
      rules: ["no-restricted-syntax"],
    });
  }
}

for (const syntax of [
  "import",
  "dynamic",
  "dynamicTemplate",
  "reexport",
  "exportAll",
  "importType",
  "tsImportType",
  "require",
  "importEquals",
]) {
  addCase(`${syntax} 不能从内部实现引用自身 feature 主入口`, {
    from: "features/CASE/utils/main.ts",
    to: "features/CASE/index.ts",
    source: "../index",
    syntax,
    rule: featureRule,
    messageId: "selfEntry",
  });
  addCase(`${syntax} 不能从内部实现引用自身 feature 子入口`, {
    from: "features/CASE/utils/main.ts",
    to: "features/CASE/canvas.ts",
    source: "../canvas",
    syntax,
    rule: featureRule,
    messageId: "selfEntry",
  });
}
cases.push({
  name: "不能经自身 feature 入口间接绕过层次限制",
  from: "features/self-entry-bypass/utils/read.ts",
  files: {
    "features/self-entry-bypass/utils/read.ts":
      'export { value } from "../index";',
    "features/self-entry-bypass/index.ts":
      'export { value } from "./components/panel";',
    "features/self-entry-bypass/components/panel.ts": "export const value = 1;",
  },
  rules: [featureRule],
  messageIds: ["selfEntry"],
});
addCase("feature 根入口可以相对聚合自身子入口", {
  from: "features/CASE/index.ts",
  to: "features/CASE/canvas.ts",
  source: "./canvas",
  syntax: "reexport",
});
addCase("自身 feature 子入口使用别名也只报告入口反向引用", {
  from: "features/CASE/utils/main.ts",
  to: "features/CASE/canvas.ts",
  source: "@/features/CASE/canvas",
  rule: featureRule,
  messageId: "selfEntry",
});
addCase("feature 内部仍通过组件入口访问同层其他组件", {
  from: "features/CASE/components/consumer.ts",
  to: "features/CASE/components/dialog/index.ts",
  source: "./dialog",
});

for (const extension of [
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mts",
  "cts",
]) {
  const commonjs = extension === "cjs";
  const importStatement = (source) =>
    commonjs
      ? `/* eslint-disable @typescript-eslint/no-require-imports -- 用例检查 require 写法的依赖 */\nmodule.exports = require("${source}");`
      : statements.import(source);
  const value = commonjs
    ? "module.exports = { value: 1 };"
    : "export const value = 1;";
  const component = `components/extension-${extension}.${extension}`;
  const feature = `features/extension-${extension}/index.ts`;
  cases.push({
    name: `.${extension} 直属组件不能反向依赖 feature`,
    from: component,
    files: {
      [component]: importStatement(`@/features/extension-${extension}`),
      [feature]: "export const value = 1;",
    },
    rules: ["import/no-restricted-paths"],
  });
  const target = `components/extension-target-${extension}.${extension}`;
  const consumer = `lib/extension-${extension}.${extension}`;
  cases.push({
    name: `.${extension} lib 不能反向依赖直属组件`,
    from: consumer,
    files: {
      [target]: value,
      [consumer]: importStatement(
        `@/components/extension-target-${extension}.${extension}`,
      ),
    },
    rules: ["import/no-restricted-paths"],
  });
  const allowed = `components/extension-allowed-${extension}.${extension}`;
  cases.push({
    name: `.${extension} 直属组件可以依赖下层 lib 且配置能正常加载`,
    from: allowed,
    files: {
      [allowed]: importStatement(
        `@/lib/extension-allowed-${extension}.${extension}`,
      ),
      [`lib/extension-allowed-${extension}.${extension}`]: value,
    },
    rules: [],
  });
  const entry = `components/entry-${extension}/index.${extension}`;
  const entryConsumer = `app/entry-${extension}.${extension}`;
  cases.push({
    name: `.${extension} 组件具名入口允许外部访问`,
    from: entryConsumer,
    files: {
      [entry]: value,
      [entryConsumer]: importStatement(
        `@/components/entry-${extension}/index.${extension}`,
      ),
    },
    rules: [],
  });
  const privateFile = `components/private-${extension}/context.${extension}`;
  const privateConsumer = `app/private-${extension}.${extension}`;
  cases.push({
    name: `.${extension} 组件私有实现不能直接被外部引用`,
    from: privateConsumer,
    files: {
      [privateFile]: value,
      [privateConsumer]: importStatement(
        `@/components/private-${extension}/context.${extension}`,
      ),
    },
    rules: [componentRule],
  });
  if (!commonjs) {
    const parts = `components/star-${extension}/parts.${extension}`;
    const starEntry = `components/star-${extension}/index.${extension}`;
    cases.push({
      name: `.${extension} 组件入口禁止星号转导出`,
      from: starEntry,
      files: {
        [parts]: value,
        [starEntry]: `export * from "./parts.${extension}";`,
      },
      rules: ["no-restricted-syntax"],
    });
    const main = `lib/cycle-${extension}/main.${extension}`;
    const peer = `lib/cycle-${extension}/peer.${extension}`;
    cases.push({
      name: `.${extension} 同层模块循环被拒绝`,
      from: main,
      files: {
        [main]: `import { peer } from "./peer.${extension}"; export const value = () => peer;`,
        [peer]: `import { value } from "./main.${extension}"; export const peer = () => value;`,
      },
      rules: ["import/no-cycle"],
    });
  }
}

// wrapper-imports 的完整消息：断言整段文本，消息里的 {{wrapper}}、{{name}} 漏传就会原样留在文本里。
const wrapperMessage = (wrapper) =>
  `Import from ${wrapper}. Only that wrapper may access the original package.`;
const uiLibraryMessage = (name) =>
  `Use the project's wrapper of ${name} from @/components/ui/. When it lacks the part you need, add that part to the wrapper. See "Wrap a UI library" in .claude/rules/design-system.md.`;

for (const syntax of [
  "import",
  "dynamic",
  "dynamicTemplate",
  "reexport",
  "exportAll",
  "importType",
  "tsImportType",
  "require",
  "importEquals",
]) {
  addCase(`${syntax} 禁止业务代码直接引用 React Query 原包`, {
    from: "app/CASE.ts",
    source: "@tanstack/react-query",
    syntax,
    rule: wrapperRule,
    message: wrapperMessage("@/lib/react-query"),
  });
  addCase(`${syntax} 允许通过公开 React Query 封装入口引用`, {
    from: "app/CASE.ts",
    source: "@/lib/react-query",
    syntax,
  });
}
addCase("React Query 原包的子路径也只能由封装引用", {
  from: "app/CASE.ts",
  source: "@tanstack/react-query/build/modern/index.js",
  rule: wrapperRule,
  message: wrapperMessage("@/lib/react-query"),
});
addCase("相似包名不被误认为 React Query 原包", {
  from: "app/CASE.ts",
  source: "@tanstack/react-query-devtools",
});
addCase("其他 lib 文件不能享有 React Query 原包豁免", {
  from: "lib/CASE.ts",
  source: "@tanstack/react-query",
  rule: wrapperRule,
});
addCase("与封装同名前缀的文件不能享有豁免", {
  from: "lib/react-query.CASE.ts",
  source: "@tanstack/react-query",
  rule: wrapperRule,
});
addCase("lib 子目录中的同名文件不能享有封装豁免", {
  from: "lib/CASE/react-query.ts",
  source: "@tanstack/react-query",
  rule: wrapperRule,
});
for (const source of ["cn", "cn/config"]) {
  addCase(`业务代码不能直接引用 ${source}`, {
    from: "app/CASE.ts",
    source,
    rule: wrapperRule,
    message: wrapperMessage("@/lib/cn"),
  });
}
cases.push({
  name: "lib/cn.ts 封装可以引用 cn 原包",
  from: "lib/cn.ts",
  files: {
    "lib/cn.ts":
      'import { value as packageValue } from "cn/config"; export const value = packageValue;',
  },
  rules: [],
});

for (const [source, name] of [
  ["@base-ui/react", "@base-ui/react"],
  ["@base-ui/react/button", "@base-ui/react"],
  ["@base-ui/react/internals/useRenderElement", "@base-ui/react"],
  ["sonner", "sonner"],
  ["input-otp", "input-otp"],
]) {
  addCase(`${source} 只能由 components/ui/ 的封装引用`, {
    source,
    rule: wrapperRule,
    message: uiLibraryMessage(name),
  });
}
for (const source of [
  "@base-ui/react/merge-props",
  "@base-ui/react/use-render",
  "@base-ui/react/types",
  "@base-ui/react/csp-provider",
  "@base-ui/react/direction-provider",
]) {
  addCase(`不渲染 UI 的 ${source} 在封装之外也能引用`, { source });
}
addCase("components/ui/ 的封装可以引用 UI 库", {
  from: "components/ui/CASE.ts",
  source: "@base-ui/react/button",
});
addCase("components/ui/ 的组件目录也可以引用 UI 库", {
  from: "components/ui/CASE/root.ts",
  source: "sonner",
});
addCase("根目录 components/ 不算 UI 库的封装", {
  from: "components/CASE.ts",
  source: "@base-ui/react/button",
  rule: wrapperRule,
  message: uiLibraryMessage("@base-ui/react"),
});
addCase("相似包名不被误认为 UI 库", {
  from: "app/CASE.ts",
  source: "@base-ui/react-native",
});

for (const extension of [
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mts",
  "cts",
]) {
  const file = `lib/react-query.${extension}`;
  cases.push({
    name: `react-query.${extension} 封装文件可以引用原包`,
    from: file,
    files: {
      [file]:
        extension === "cjs"
          ? '/* eslint-disable @typescript-eslint/no-require-imports -- 用例检查 require 写法的依赖 */\nmodule.exports = require("@tanstack/react-query");'
          : `import { value as packageValue } from "@tanstack/react-query"; export const value = packageValue;${["ts", "tsx", "mts", "cts"].includes(extension) ? " export type Item = { value: number };" : ""}`,
    },
    rules: [],
  });
}

for (const privateFile of [
  "context.ts",
  "use-dialog-context.ts",
  "helpers.ts",
]) {
  addCase(`组件内部可以相对引用私有 ${privateFile}`, {
    from: "components/ui/CASE/root.ts",
    to: `components/ui/CASE/${privateFile}`,
    source: `./${privateFile}`,
  });
  for (const syntax of [
    "import",
    "dynamicTemplate",
    "reexport",
    "tsImportType",
    "require",
    "importEquals",
  ]) {
    addCase(`${syntax} 禁止组件外部访问私有 ${privateFile}`, {
      from: "app/CASE.ts",
      to: `components/ui/CASE/${privateFile}`,
      source: `@/components/ui/CASE/${privateFile}`,
      syntax,
      rule: componentRule,
    });
  }
}
cases.push({
  name: "复合组件可以共享私有 Context 并经入口显式导出各部件",
  from: "components/ui/dialog-with-context/index.ts",
  files: {
    "components/ui/dialog-with-context/context.ts":
      "export const context = { open: false };",
    "components/ui/dialog-with-context/use-dialog-context.ts":
      'import { context } from "./context"; export const useDialogContext = () => context;',
    "components/ui/dialog-with-context/root.ts":
      'import { useDialogContext } from "./use-dialog-context"; export const Root = useDialogContext;',
    "components/ui/dialog-with-context/trigger.ts":
      'import { useDialogContext } from "./use-dialog-context"; export const Trigger = useDialogContext;',
    "components/ui/dialog-with-context/index.ts":
      'export { Root } from "./root"; export { Trigger } from "./trigger";',
  },
  rules: [],
});

for (const directory of [
  "components/CASE",
  "components/ui/CASE",
  "app/CASE/_components/dialog",
  "features/CASE/components/dialog",
]) {
  const feature = directory.startsWith("features/");
  for (const syntax of [
    "import",
    "dynamic",
    "dynamicTemplate",
    "reexport",
    "exportAll",
    "importType",
    "tsImportType",
    "require",
    "importEquals",
  ]) {
    addCase(`${directory} 内部 ${syntax} 别名引用只报告一次路径错误`, {
      from: `${directory}/main.ts`,
      to: `${directory}/private.ts`,
      source: `@/${directory}/private`,
      syntax,
      rule: feature ? featureRule : componentRule,
      messageId: "relative",
    });
  }
  addCase(`${directory} 内部相对路径仍然允许`, {
    from: `${directory}/main.ts`,
    to: `${directory}/private.ts`,
    source: "./private",
  });
}
addCase("全局组件可以通过别名引用其他组件入口", {
  from: "components/CASE-consumer/main.ts",
  to: "components/CASE-provider/index.ts",
  source: "@/components/CASE-provider",
});
addCase("UI 组件可以通过别名引用其他 UI 组件入口", {
  from: "components/ui/CASE-consumer/main.ts",
  to: "components/ui/CASE-provider/index.ts",
  source: "@/components/ui/CASE-provider",
});
addCase("app 局部组件可以通过别名引用全局组件入口", {
  from: "app/CASE/_components/dialog/main.ts",
  to: "components/CASE/index.ts",
  source: "@/components/CASE",
});

for (const extension of [
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mts",
  "cts",
]) {
  const directory = `components/duplicate-entry-${extension}`;
  const otherExtension = extension === "ts" ? "tsx" : "ts";
  cases.push({
    name: `index.${extension} 与其他源码入口并存时单文件 lint 也会报错`,
    from: `${directory}/index.${extension}`,
    files: {
      [`${directory}/index.${extension}`]:
        extension === "cjs"
          ? "module.exports = {};"
          : "export const value = 1;",
      [`${directory}/index.${otherExtension}`]: "export const otherValue = 2;",
    },
    rules: [componentEntryRule],
    messageIds: ["multiple"],
  });
}
for (const directory of [
  "components/ui/duplicate-entry",
  "app/duplicate-entry/_components/dialog",
  "features/duplicate-entry/components/dialog",
]) {
  cases.push({
    name: `${directory} 同时存在 index.ts 与 index.tsx 被拒绝`,
    from: `${directory}/index.ts`,
    files: {
      [`${directory}/index.ts`]: "export const value = 1;",
      [`${directory}/index.tsx`]: "export const otherValue = 2;",
    },
    rules: [componentEntryRule],
    messageIds: ["multiple"],
  });
}
for (const [implementation, declaration] of [
  ["ts", "d.ts"],
  ["mts", "d.mts"],
  ["cts", "d.cts"],
]) {
  const directory = `components/declaration-entry-${implementation}`;
  const files = {
    [`${directory}/index.${implementation}`]: "export const value = 1;",
    [`${directory}/index.${declaration}`]:
      "export declare const value: number;",
  };
  for (const extension of [implementation, declaration]) {
    cases.push({
      name: `${extension} 类型声明入口与实现入口并存时不误报`,
      from: `${directory}/index.${extension}`,
      files,
      rules: [],
    });
  }
}
for (const directory of [
  "components",
  "components/ui",
  "features/non-component-entry",
]) {
  cases.push({
    name: `${directory} 集合或 feature 根目录不按组件目录检查唯一入口`,
    from: `${directory}/index.ts`,
    files: {
      [`${directory}/index.ts`]: "export const value = 1;",
      [`${directory}/index.tsx`]: "export const otherValue = 2;",
    },
    rules: [],
  });
}

const namespaceExports = [
  ["直接具名导出 namespace", "export { Parts };", true],
  ["重命名导出 namespace", "export { Parts as Dialog };", true],
  ["默认导出 namespace", "export default Parts;", true],
  ["具名导出 namespace 为 default", "export { Parts as default };", true],
  ["导出初始化为 namespace 的变量", "export const Dialog = Parts;", true],
  [
    "经 const 别名导出 namespace",
    "const Dialog = Parts; export { Dialog };",
    true,
  ],
  [
    "经多层 const 别名默认导出 namespace",
    "const First = Parts; const Dialog = First; export default Dialog;",
    true,
  ],
  [
    "经 const 别名初始化公开变量",
    "const Alias = Parts; export const Dialog = Alias;",
    true,
  ],
  [
    "类型断言不隐藏 namespace 导出",
    "export const Dialog = Parts as typeof Parts;",
    true,
  ],
  [
    "satisfies 不隐藏 namespace 导出",
    "export const Dialog = Parts satisfies typeof Parts;",
    true,
  ],
  [
    "对象展开不能整体暴露 namespace",
    "export const Dialog = { ...Parts };",
    true,
  ],
  ["对象属性不能整体携带 namespace", "export const Dialog = { Parts };", true],
  [
    "嵌套对象不能整体携带 namespace",
    "export const Dialog = { nested: { Parts } };",
    true,
  ],
  ["数组不能整体携带 namespace", "export const Dialog = [Parts];", true],
  [
    "对象 const 别名不能隐藏 namespace",
    "const Alias = { ...Parts }; export const Dialog = Alias;",
    true,
  ],
  [
    "先导出后声明别名也不能暴露 namespace",
    "export { Dialog }; const Dialog = Parts;",
    true,
  ],
  [
    "对象剩余属性不能整体暴露 namespace",
    "const { ...Dialog } = Parts; export { Dialog };",
    true,
  ],
  [
    "排除个别成员后仍不能导出 namespace 剩余属性",
    "const { Root, ...Dialog } = Parts; export { Root, Dialog };",
    true,
  ],
  [
    "直接导出解构变量不能暴露 namespace 剩余属性",
    "export const { ...Dialog } = Parts;",
    true,
  ],
  ["选择 namespace 的单个成员", "export const Root = Parts.Root;", false],
  [
    "显式选择 namespace 多个成员组成复合组件",
    "export const Dialog = { Root: Parts.Root, Trigger: Parts.Trigger };",
    false,
  ],
  [
    "内部 namespace 别名仅用于选取成员",
    "const Alias = Parts; export const Root = Alias.Root;",
    false,
  ],
  [
    "解构选取 namespace 成员",
    "const { Root, Trigger } = Parts; export { Root, Trigger };",
    false,
  ],
  [
    "显式成员对象的剩余属性可以导出",
    "const Explicit = { Root: Parts.Root }; const { ...Dialog } = Explicit; export { Dialog };",
    false,
  ],
  [
    "namespace 内部使用与局部同名变量不会误报",
    "export const Root = Parts.Root; function createDialog() { const Parts = { open: false }; return Parts; } export const Dialog = createDialog();",
    false,
  ],
];
for (const [name, statement, rejected] of namespaceExports) {
  const directory = `components/namespace-export-${cases.length}`;
  cases.push({
    name: `组件入口${name}`,
    from: `${directory}/index.ts`,
    files: {
      [`${directory}/parts.ts`]:
        "export const Root = 1; export const Trigger = 2; export type Props = { open: boolean };",
      [`${directory}/index.ts`]: `import * as Parts from "./parts"; ${statement}`,
    },
    rules: rejected ? [componentExportsRule] : [],
    messageIds: rejected ? ["namespace"] : undefined,
  });
}
for (const [name, statement, rejected] of [
  ["不能通过 export = 整体暴露 namespace", "export = Parts;", true],
  ["可以通过 export = 显式导出 namespace 成员", "export = Parts.Root;", false],
]) {
  const directory = `components/export-assignment-${cases.length}`;
  cases.push({
    name: `.cts 组件入口${name}`,
    from: `${directory}/index.cts`,
    files: {
      [`${directory}/parts.ts`]:
        "export const Root = 1; export const Trigger = 2;",
      [`${directory}/index.cts`]: `import * as Parts from "./parts"; ${statement}`,
    },
    rules: rejected ? [componentExportsRule] : [],
    messageIds: rejected ? ["namespace"] : undefined,
  });
}
cases.push({
  name: "app 里 _components/ 的组件入口同样禁止星号转导出",
  from: "app/star-entry/_components/widget/index.ts",
  files: {
    "app/star-entry/_components/widget/parts.ts": "export const value = 1;",
    "app/star-entry/_components/widget/index.ts": 'export * from "./parts";',
  },
  rules: ["no-restricted-syntax"],
});
cases.push({
  name: "feature 里 components/ 的组件入口同样禁止星号转导出",
  from: "features/star-entry/components/widget/index.ts",
  files: {
    "features/star-entry/components/widget/parts.ts": "export const value = 1;",
    "features/star-entry/components/widget/index.ts":
      'export * from "./parts";',
  },
  rules: ["no-restricted-syntax"],
});
cases.push({
  name: "app 里 _components/ 的组件入口同样不能整体转出 namespace",
  from: "app/namespace-entry/_components/widget/index.ts",
  files: {
    "app/namespace-entry/_components/widget/parts.ts":
      "export const Root = 1; export const Trigger = 2;",
    "app/namespace-entry/_components/widget/index.ts":
      'import * as Parts from "./parts"; export { Parts };',
  },
  rules: [componentExportsRule],
  messageIds: ["namespace"],
});
cases.push({
  name: "组件入口不能整体转出类型 namespace",
  from: "components/type-namespace-export/index.ts",
  files: {
    "components/type-namespace-export/parts.ts":
      "export type Props = { open: boolean };",
    "components/type-namespace-export/index.ts":
      'import type * as Parts from "./parts"; export type { Parts };',
  },
  rules: [componentExportsRule],
  messageIds: ["namespace"],
});
cases.push({
  name: "组件入口内部使用 React namespace 并选取成员仍然允许",
  from: "components/react-namespace-internal/index.tsx",
  files: {
    "components/react-namespace-internal/index.tsx":
      'import * as React from "react"; export type Props = { children: React.ReactNode }; export const Root = React.Fragment;',
  },
  rules: [],
});
cases.push({
  name: "组件入口可以导出具名导入的组件与类型别名",
  from: "components/explicit-import-exports/index.ts",
  files: {
    "components/explicit-import-exports/parts.ts":
      "export const Root = 1; export const Trigger = 2; export type Props = { open: boolean };",
    "components/explicit-import-exports/index.ts":
      'import { Root as DialogRoot, Trigger } from "./parts"; import type { Props } from "./parts"; export { DialogRoot, Trigger }; export type { Props };',
  },
  rules: [],
});
cases.push({
  name: "组件实现文件的内部 namespace 导出不被入口规则误报",
  from: "components/private-namespace-export/internal.ts",
  files: {
    "components/private-namespace-export/parts.ts": "export const Root = 1;",
    "components/private-namespace-export/internal.ts":
      'import * as Parts from "./parts"; export { Parts };',
  },
  rules: [],
});
cases.push({
  name: "feature 根入口不被组件 namespace 导出规则误报",
  from: "features/feature-namespace-export/index.ts",
  files: {
    "features/feature-namespace-export/utils/parts.ts":
      "export const value = 1;",
    "features/feature-namespace-export/index.ts":
      'import * as Parts from "./utils/parts"; export { Parts };',
  },
  rules: [],
});

addCase("根目录代码跨目录用相对路径被拒绝", {
  from: "lib/CASE.ts",
  to: "utils/CASE.ts",
  source: "../utils/CASE",
  rule: rootRule,
  messageId: "alias",
});
addCase("根目录代码同目录用 @/ 被拒绝", {
  from: "utils/CASE-a.ts",
  to: "utils/CASE-b.ts",
  source: "@/utils/CASE-b",
  rule: rootRule,
  messageId: "relative",
});
addCase("app 引用子目录用 @/ 被拒绝", {
  from: "app/CASE/page.tsx",
  to: "app/CASE/parts/value.ts",
  source: "@/app/CASE/parts/value",
  rule: rootRule,
  messageId: "relative",
});
addCase("根目录代码跨目录用 @/ 允许", {
  from: "lib/CASE.ts",
  to: "utils/CASE.ts",
  source: "@/utils/CASE",
});
addCase("app 引用子目录用相对路径允许", {
  from: "app/CASE/page.tsx",
  to: "app/CASE/parts/value.ts",
  source: "./parts/value",
});
addCase("app 内部引用上层目录用 @/ 被拒绝", {
  from: "app/CASE/a/page.tsx",
  to: "app/CASE/shared.ts",
  source: "@/app/CASE/shared",
  rule: rootRule,
  messageId: "relative",
});
addCase("app 内部引用上层目录用 ../ 允许", {
  from: "app/CASE/a/page.tsx",
  to: "app/CASE/shared.ts",
  source: "../shared",
});
addCase("app 引用 app 根目录的文件用 @/ 被拒绝", {
  from: "app/CASE/page.tsx",
  to: "app/CASE-root.ts",
  source: "@/app/CASE-root",
  rule: rootRule,
  messageId: "relative",
});
addCase("app 用相对路径引用 app 外被拒绝", {
  from: "app/CASE/page.tsx",
  to: "lib/CASE.ts",
  source: "../../lib/CASE",
  rule: rootRule,
  messageId: "alias",
});

addCase("比 _components/ 更高的文件引用它被拒绝", {
  from: "app/CASE/page.tsx",
  to: "app/CASE/(shop)/_components/badge.ts",
  source: "./(shop)/_components/badge",
  rule: placementRule,
  messageId: "above",
});
addCase("更深的文件往上引用 _components/ 允许", {
  from: "app/CASE/(shop)/a/page.tsx",
  to: "app/CASE/(shop)/_components/badge.ts",
  source: "../_components/badge",
});
const importing = (source) =>
  `import { value } from "${source}"; export const result = value;`;
for (const [name, from, files, messageIds] of [
  [
    "使用方都在更深的同一个目录时，_components/ 里的模块被要求往下挪",
    "app/placement-deeper/(shop)/_components/badge.ts",
    {
      "app/placement-deeper/(shop)/_components/badge.ts":
        "export const value = 1;",
      "app/placement-deeper/(shop)/@count/[...path]/page.ts": importing(
        "../../_components/badge",
      ),
    },
    ["deeper"],
  ],
  [
    "使用方分散在多个子目录时，_components/ 在它们的最近公共祖先允许",
    "app/placement-shared/(shop)/_components/badge.ts",
    {
      "app/placement-shared/(shop)/_components/badge.ts":
        "export const value = 1;",
      "app/placement-shared/(shop)/layout.ts": importing("./_components/badge"),
      "app/placement-shared/(shop)/a/page.ts": importing(
        "../_components/badge",
      ),
    },
    [],
  ],
  [
    "只被同一个 _components/ 里的文件使用，算同一层",
    "app/placement-sibling/(shop)/_components/helper.ts",
    {
      "app/placement-sibling/(shop)/_components/helper.ts":
        "export const value = 1;",
      "app/placement-sibling/(shop)/_components/nav.ts": importing("./helper"),
      "app/placement-sibling/(shop)/layout.ts": importing("./_components/nav"),
    },
    [],
  ],
  [
    "旁边的测试不算使用方",
    "app/placement-test/(shop)/_components/badge.ts",
    {
      "app/placement-test/(shop)/_components/badge.ts":
        "export const value = 1;",
      "app/placement-test/(shop)/_components/badge.test.ts":
        importing("./badge"),
      "app/placement-test/(shop)/a/page.ts": importing("../_components/badge"),
    },
    ["deeper"],
  ],
  [
    "同一个 _components/ 里的 -test-helpers 文件也不算使用方",
    "app/placement-test-helpers/(shop)/_components/badge.ts",
    {
      "app/placement-test-helpers/(shop)/_components/badge.ts":
        "export const value = 1;",
      "app/placement-test-helpers/(shop)/_components/badge-test-helpers.ts":
        importing("./badge"),
      "app/placement-test-helpers/(shop)/a/page.ts": importing(
        "../_components/badge",
      ),
    },
    ["deeper"],
  ],
  [
    "组件目录整体算一个模块，在它的 index 上报告",
    "app/placement-directory/(shop)/_components/dialog/index.ts",
    {
      "app/placement-directory/(shop)/_components/dialog/part.ts":
        "export const value = 1;",
      "app/placement-directory/(shop)/_components/dialog/index.ts":
        'export { value } from "./part";',
      "app/placement-directory/(shop)/a/page.ts": importing(
        "../_components/dialog",
      ),
    },
    ["deeper"],
  ],
  [
    "组件目录的内部文件不重复报告",
    "app/placement-directory-part/(shop)/_components/dialog/part.ts",
    {
      "app/placement-directory-part/(shop)/_components/dialog/part.ts":
        "export const value = 1;",
      "app/placement-directory-part/(shop)/_components/dialog/index.ts":
        'export { value } from "./part";',
      "app/placement-directory-part/(shop)/a/page.ts": importing(
        "../_components/dialog",
      ),
    },
    [],
  ],
]) {
  cases.push({
    name,
    from,
    files,
    rules: messageIds.map(() => placementRule),
    messageIds: messageIds.length ? messageIds : undefined,
  });
}
addCase("scripts/ 跨目录可以用相对路径", {
  from: "scripts/CASE/main.mjs",
  to: "scripts/other-CASE/value.mjs",
  source: "../other-CASE/value.mjs",
});
addCase("相对路径引用 npm 包被拒绝", {
  from: "lib/CASE.ts",
  source: "../node_modules/react",
  rule: "import/no-relative-packages",
});

for (const [name, from, rules] of [
  ["camelCase 文件名被拒绝", "utils/formatBytes.ts", [namingRule]],
  [
    "PascalCase 目录名被拒绝",
    "features/TaskBoard/utils/value.ts",
    [namingRule],
  ],
  ["点分段文件名和点开头的目录允许", ".config/naming.example.ts", []],
  [
    "app/ 下的路由组、并行路由、拦截路由和动态段允许",
    "app/(shop)/@modal/(..)items/[itemId]/page.tsx",
    [],
  ],
  [
    "app/ 下的私有目录和 catch-all 段允许",
    "app/_internal/[...catchAll]/[[...rest]]/page.tsx",
    [],
  ],
  [
    "Next.js 路由写法只在 app/ 下允许",
    "components/_private/value.ts",
    [namingRule],
  ],
  [
    "app/ 下的文件名仍然要 kebab-case",
    "app/[id]/PageContent.tsx",
    [namingRule],
  ],
  ["动态段名用 snake_case 被拒绝", "app/[task_id]/page.tsx", [namingRule]],
  [
    "app/ 下路由专用的组件放在 _components/ 允许",
    "app/(shop)/_components/cart-summary.tsx",
    [],
  ],
  ["app/ 下名为 components 的路由允许", "app/[locale]/components/page.tsx", []],
]) {
  cases.push({
    name: `文件命名：${name}`,
    from,
    files: { [from]: "export const value = 1;" },
    rules,
  });
}

for (const [name, from, directive, rules] of [
  [
    "eslint-disable 不写原因被拒绝",
    "utils/disable-without-reason.ts",
    "// eslint-disable-next-line @typescript-eslint/no-explicit-any",
    ["@eslint-community/eslint-comments/require-description"],
  ],
  [
    "eslint-disable 在 -- 后写明原因允许",
    "utils/disable-with-reason.ts",
    "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 第三方回调的参数没有类型",
    [],
  ],
]) {
  cases.push({
    name: `禁用注释：${name}`,
    from,
    files: { [from]: `${directive}\nexport const value: any = 1;` },
    rules,
  });
}

/**
 * 在临时目录里放一份只有 template 配置的项目：eslint.config.mjs 和它 import 的 scripts/，不带派生项目的
 * eslint.config.project.mjs，所以用例只验证 template 自己的规则。
 */
function createConfigFixture() {
  const fixture = realpathSync(
    mkdtempSync(join(tmpdir(), "next-template-eslint-")),
  );
  copyFileSync(
    join(project, "eslint.config.mjs"),
    join(fixture, "eslint.config.mjs"),
  );
  cpSync(join(project, "scripts/eslint"), join(fixture, "scripts/eslint"), {
    recursive: true,
  });
  // eslint.config.mjs 从这里取 build 目录的忽略项。
  copyFileSync(
    join(project, "scripts/build-dirs.mjs"),
    join(fixture, "scripts/build-dirs.mjs"),
  );
  // architecture/catalog-examples 从生成器取示例目录的位置。
  mkdirSync(join(fixture, "scripts/ui-catalog"));
  copyFileSync(
    join(project, "scripts/ui-catalog/index-generator.mjs"),
    join(fixture, "scripts/ui-catalog/index-generator.mjs"),
  );
  // docs 规则从这里取 Sample product 的路径，eslint.config.mjs 从 skills-lock.json 取它们跳过的第三方 skill。
  copyFileSync(
    join(project, "scripts/sample-product.mjs"),
    join(fixture, "scripts/sample-product.mjs"),
  );
  copyFileSync(
    join(project, "skills-lock.json"),
    join(fixture, "skills-lock.json"),
  );
  copyFileSync(join(project, "tsconfig.json"), join(fixture, "tsconfig.json"));
  // import/no-relative-packages 要找被 lint 文件所属的 package.json，找不到会直接抛错。
  copyFileSync(join(project, "package.json"), join(fixture, "package.json"));
  // Windows 上建目录 symlink 要管理员权限或开发者模式，junction 不用；其他系统忽略这个参数。
  symlinkSync(
    join(project, "node_modules"),
    join(fixture, "node_modules"),
    "junction",
  );
  return fixture;
}

describe("架构依赖和 feature、组件导入约定", () => {
  let previousCwd;
  let fixture;
  let eslint;

  beforeAll(() => {
    previousCwd = process.cwd();
    fixture = createConfigFixture();
    for (const { files } of cases) {
      for (const [filename, content] of Object.entries(files)) {
        const file = join(fixture, filename);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
      }
    }

    // import 解析器也会看 process.cwd()；遍历依赖图之前所有文件都要已经存在。
    process.chdir(fixture);
    // 架构用例只验证依赖边界；import 排序由下方独立用例验证。
    // fixture 会用 type 别名和类型断言构造场景，TypeScript 写法规则在这里关掉。
    // 组件入口的 namespace 用例会默认导出，import/no-default-export 由下方「组件写成具名的 function 声明」验证。
    // fixture 没有 docs/features.md，feature 依赖图由 scripts/eslint/architecture/feature-dependencies.test.mjs 验证。
    // fixture 里 components/ui/ 的文件没有 UI catalog 示例目录：规则本身由
    // scripts/eslint/architecture/catalog-examples.test.mjs 验证，项目配置开着它由下方「components/ui/ 的组件和
    // UI catalog 的示例目录一一对应」验证。
    // fixture 的 server/ 和 -action 文件只为验证依赖方向，不写 import "server-only" 和 "use server"；这两条规则由
    // 下方独立用例验证。
    eslint = new ESLint({
      cwd: fixture,
      overrideConfig: {
        rules: {
          "architecture/feature-dependencies": "off",
          "architecture/catalog-examples": "off",
          "data-flow/server-only": "off",
          "data-flow/action-module": "off",
          "simple-import-sort/imports": "off",
          "@typescript-eslint/consistent-type-definitions": "off",
          "@typescript-eslint/consistent-type-assertions": "off",
          "@typescript-eslint/no-non-null-assertion": "off",
          "import/no-default-export": "off",
        },
      },
    });
  });

  afterAll(() => {
    process.chdir(previousCwd);
    rmSync(fixture, { recursive: true, force: true });
  });

  for (const { name, from, rules, messageIds, messages } of cases) {
    test(name, async () => {
      const [result] = await eslint.lintFiles([join(fixture, from)]);
      expect(
        result.messages.map(({ ruleId }) => ruleId).sort(),
        JSON.stringify(result.messages, null, 2),
      ).toStrictEqual([...rules].sort());
      if (messageIds) {
        expect(
          result.messages.map(({ messageId }) => messageId).sort(),
        ).toStrictEqual([...messageIds].sort());
      }
      if (messages) {
        expect(
          result.messages.map(({ message }) => message).sort(),
        ).toStrictEqual([...messages].sort());
      }
    });
  }
});

describe("import 按四组自动修复，保留客户端指令和副作用导入的相对顺序", () => {
  const source = `"use client";

import "./z-reset.css";
import { local } from "./local";
import { helper } from "@/utils/import-group-helper";
import "server-only";
import { join } from "node:path";
import "some-polyfill";
import { upstream } from "../upstream";
import { useState } from "react";
import { scoped } from "@scope/package";
import "@/styles/base.css";
import "package/theme.css";
import styles from "./panel.module.css";

export const values = [local, helper, join, upstream, useState, scoped, styles];
`;
  const expected = `"use client";

import "server-only";
import "some-polyfill";
import { join } from "node:path";
import { scoped } from "@scope/package";
import { useState } from "react";

import { helper } from "@/utils/import-group-helper";

import { upstream } from "../upstream";
import { local } from "./local";

import "./z-reset.css";
import "@/styles/base.css";
import "package/theme.css";
import styles from "./panel.module.css";

export const values = [local, helper, join, upstream, useState, scoped, styles];
`;
  const eslint = new ESLint({ cwd: project });
  const fixer = new ESLint({ cwd: project, fix: true });
  for (const extension of ["js", "jsx", "mjs", "ts", "tsx", "mts", "cts"]) {
    test(`.${extension} 应用同一套分组并支持自动修复`, async () => {
      // 应用代码目录跨目录必须用 @/，../ 分组放在不受 root-imports 约束的 scripts/ 下演示。
      const options = {
        filePath: join(project, `scripts/import-groups.${extension}`),
      };
      const [before] = await eslint.lintText(source, options);
      expect(
        before.messages.map(({ ruleId, severity }) => ({ ruleId, severity })),
      ).toStrictEqual([{ ruleId: "simple-import-sort/imports", severity: 2 }]);
      const [after] = await fixer.lintText(source, options);
      expect(after.messages).toStrictEqual([]);
      expect(after.output).toBe(expected);
      const [stable] = await fixer.lintText(expected, options);
      expect(stable.output).toBe(undefined);
      expect(stable.messages).toStrictEqual([]);
    });
  }
});

describe("UI catalog 的生成索引按生成器的顺序 import", () => {
  // import/no-cycle 关掉：order-probe.ts 不在磁盘上。
  const eslint = new ESLint({
    cwd: project,
    overrideConfig: { rules: { "import/no-cycle": "off" } },
  });
  // 生成器按码点排序，basic-disabled 排在 basic 前面。
  const source = `// 此文件由 scripts/ui-catalog/index-generator.mjs 自动生成，请勿手动修改。

"use client";

import type { ExampleDefinition } from "../../types/examples";
import {
  Example as Example0,
  metadata as metadata0,
} from "./basic-disabled.example";
import { Example as Example1, metadata as metadata1 } from "./basic.example";

export const examples = [
  { ...metadata0, id: "basic-disabled", component: Example0 },
  { ...metadata1, id: "basic", component: Example1 },
] satisfies readonly ExampleDefinition[];
`;
  const sortReports = async (file) => {
    const [result] = await eslint.lintText(source, {
      filePath: join(
        project,
        "features/ui-catalog/components/button-examples",
        file,
      ),
    });
    return result.messages.filter(
      ({ ruleId }) => ruleId === "simple-import-sort/imports",
    );
  };

  test("生成索引不检查 import 顺序", async () => {
    expect(await sortReports("examples.generated.ts")).toStrictEqual([]);
  });

  test("同目录的其他文件照样检查", async () => {
    expect(await sortReports("order-probe.ts")).toHaveLength(1);
  });
});

describe("数据访问规则覆盖 React Query 封装、mutation 回调和请求库", () => {
  // import/no-cycle 遍历依赖图时要求被检查的文件真实存在，lintText 的虚拟文件会让它崩溃。
  const eslint = new ESLint({
    cwd: project,
    overrideConfig: { rules: { "import/no-cycle": "off" } },
  });
  const filePath = join(project, "app/query-rules.tsx");
  const header = `import { useCallback } from "react";

import {
  QueryClient,
  queryOptions,
  useMutation,
  useQuery,
} from "@/lib/react-query";

const options = queryOptions({ queryKey: ["a"], queryFn: () => 1 });
`;
  const examples = [
    {
      name: "内联 queryKey 和 queryFn 要求改用 queryOptions",
      body: `export function Example() {
  return useQuery({ queryKey: ["a"], queryFn: () => 1 }).data;
}`,
      rules: ["@tanstack/query/prefer-query-options"],
    },
    {
      name: "对 query 结果做 rest 解构会订阅全部字段",
      body: `export function Example() {
  const { data, ...rest } = useQuery(options);
  return [data, rest];
}`,
      rules: ["@tanstack/query/no-rest-destructuring"],
    },
    {
      name: "mutation 结果对象不能作为依赖",
      body: `export function Example() {
  const mutation = useMutation({ mutationFn: () => Promise.resolve(1) });
  return useCallback(() => mutation.mutate(), [mutation]);
}`,
      rules: ["@tanstack/query/no-unstable-deps"],
    },
    {
      name: "客户端组件每次渲染新建 QueryClient",
      body: `export function Example() {
  const client = new QueryClient();
  return client;
}`,
      rules: ["@tanstack/query/stable-query-client"],
    },
    {
      name: "async Server Component 可以按渲染新建 QueryClient",
      body: `export async function Example() {
  const client = new QueryClient();
  await client.query(options);
  return client;
}`,
      rules: [],
    },
  ];
  for (const { name, body, rules } of examples) {
    test(name, async () => {
      const [result] = await eslint.lintText(`${header}\n${body}\n`, {
        filePath,
      });
      expect(result.fatalErrorCount).toBe(0);
      // 各示例共用 header 的 import，未使用的 import 不在这组用例的检查范围内。
      expect(
        result.messages
          .map(({ ruleId }) => ruleId)
          .filter((ruleId) => ruleId?.startsWith("@tanstack/query/"))
          .sort(),
        JSON.stringify(result.messages, null, 2),
      ).toStrictEqual(rules);
    });
  }
  for (const { name, body, reported } of [
    {
      name: "useMutation 里的回调会替换工厂的回调",
      body: `export function Example() {
  return useMutation({
    ...mutationOptions({ mutationFn: () => Promise.resolve(1) }),
    onMutate: () => undefined,
    onSuccess: () => undefined,
    "onError": () => undefined,
    onSettled: () => undefined,
  });
}`,
      reported: ["onMutate", "onSuccess", "onError", "onSettled"],
    },
    {
      name: "回调写在 mutationOptions 工厂和 mutate 里不报错",
      body: `const factory = () =>
  mutationOptions({
    mutationFn: () => Promise.resolve(1),
    onSuccess: () => undefined,
  });

export function Example() {
  const mutation = useMutation(factory());
  return () => mutation.mutate(undefined, { onSuccess: () => undefined });
}`,
      reported: [],
    },
  ]) {
    test(name, async () => {
      const [result] = await eslint.lintText(
        `import { mutationOptions, useMutation } from "@/lib/react-query";\n\n${body}\n`,
        { filePath },
      );
      expect(
        result.messages
          .filter(
            ({ ruleId }) => ruleId === "@tanstack/query/mutation-callbacks",
          )
          .map(({ message }) => message.match(/^Keep (\w+)/)?.[1]),
        JSON.stringify(result.messages, null, 2),
      ).toStrictEqual(reported);
    });
  }
  for (const {
    name,
    file,
    imports = "infiniteQueryOptions, mutationOptions, queryOptions",
    body,
    reported,
  } of [
    {
      name: "update- 文件里的 queryOptions 要放回 get- 文件",
      file: "features/example/api/update-task-favorite.ts",
      body: "export const favorites = queryOptions({ queryKey: ['a'], queryFn: () => 1 });",
      reported: ["query"],
    },
    {
      name: "create- 文件里的 infiniteQueryOptions 要放回 get- 文件",
      file: "features/example/api/create-task.ts",
      body: "export const feed = infiniteQueryOptions({ queryKey: ['a'], queryFn: () => 1, initialPageParam: 1, getNextPageParam: () => 2 });",
      reported: ["query"],
    },
    {
      name: "delete- 文件里改名引入的 queryOptions 也要放回 get- 文件",
      file: "features/example/api/delete-task.ts",
      imports: "queryOptions as listOptions",
      body: "export const list = listOptions({ queryKey: ['a'], queryFn: () => 1 });",
      reported: ["query"],
    },
    {
      name: "get- 文件里的 mutationOptions 要放进写操作的文件，这里不再查它的 action",
      file: "features/example/api/get-tasks.ts",
      body: "export const save = mutationOptions({ mutationFn: () => Promise.resolve(1) });",
      reported: ["mutation"],
    },
    {
      name: "get- 文件放 query 工厂不报错",
      file: "features/example/api/get-tasks.ts",
      body: "export const list = queryOptions({ queryKey: ['a'], queryFn: () => 1 });",
      reported: [],
    },
    {
      name: "update- 文件放 mutationOptions 并 import 它的 action 不报错",
      file: "features/example/api/update-task.ts",
      body: 'import { updateTaskAction } from "./update-task-action";\nexport const save = mutationOptions({ mutationFn: updateTaskAction });',
      reported: [],
    },
    {
      name: "放 mutationOptions 的文件没有 import 同目录的 action 要报错",
      file: "features/example/api/update-task.ts",
      body: "export const save = mutationOptions({ mutationFn: () => Promise.resolve(1) });",
      reported: ["action"],
    },
    {
      name: "领域动词的文件只放 query 工厂不报错",
      file: "features/example/api/search-tasks.ts",
      body: "export const search = queryOptions({ queryKey: ['a'], queryFn: () => 1 });",
      reported: [],
    },
    {
      name: "领域动词的文件同时放 query 工厂和 mutationOptions 要报错",
      file: "features/example/api/retry-task.ts",
      body: "import { retryTaskAction } from \"./retry-task-action\";\nexport const status = queryOptions({ queryKey: ['a'], queryFn: () => 1 });\nexport const retry = mutationOptions({ mutationFn: retryTaskAction });",
      reported: ["mixed"],
    },
    {
      name: "领域动词的文件放 mutationOptions 也要 import 它的 action",
      file: "features/example/api/retry-task.ts",
      body: "export const retry = mutationOptions({ mutationFn: () => Promise.resolve(1) });",
      reported: ["action"],
    },
    {
      name: "api/ 以外的文件不检查",
      file: "features/example/utils/update-task.ts",
      body: "export const list = queryOptions({ queryKey: ['a'], queryFn: () => 1 });",
      reported: [],
    },
  ]) {
    test(name, async () => {
      const [result] = await eslint.lintText(
        `import { ${imports} } from "@/lib/react-query";\n\n${body}\n`,
        { filePath: join(project, file) },
      );
      expect(
        result.messages
          .filter(
            ({ ruleId }) => ruleId === "@tanstack/query/api-file-factories",
          )
          .map(({ messageId }) => messageId),
        JSON.stringify(result.messages, null, 2),
      ).toStrictEqual(reported);
    });
  }
  for (const source of ["axios", "swr", "swr/mutation"]) {
    test(`禁止引入 ${source}`, async () => {
      const [result] = await eslint.lintText(
        `import value from "${source}";\n\nexport const result = value;\n`,
        { filePath },
      );
      expect(result.messages.map(({ ruleId }) => ruleId)).toStrictEqual([
        "no-restricted-imports",
      ]);
    });
  }
});

describe("服务端代码不用 fetchApi 或 fetch 请求本 app 自己的接口", () => {
  const eslint = new ESLint({
    cwd: project,
    overrideConfig: { rules: { "import/no-cycle": "off" } },
  });
  const request = (url, raw) =>
    raw ? `fetch(${url})` : `fetchApi({ url: ${url}, schema: z.null() })`;
  for (const { name, file, directive = "", url, raw, reported } of [
    {
      name: "Route Handler 用裸 fetch 请求同源路径时报错",
      file: "app/api/probe/route.ts",
      url: `"/api/tasks"`,
      raw: true,
      reported: 1,
    },
    {
      name: "裸 fetch 的同源路径以 BASE_PATH 开头也报错",
      file: "app/api/probe/route.ts",
      url: "`${BASE_PATH}/api/tasks/${id}`",
      raw: true,
      reported: 1,
    },
    {
      name: "服务端用裸 fetch 请求其他服务的完整 URL 不报",
      file: "features/ui-catalog/server/probe.ts",
      url: `"https://api.example.com/v1/items"`,
      raw: true,
      reported: 0,
    },
    {
      name: "feature 的浏览器请求模块用裸 fetch 请求同源路径不报",
      file: "features/ui-catalog/api/get-probe.ts",
      url: "`${BASE_PATH}/api/tasks/${id}`",
      raw: true,
      reported: 0,
    },
    {
      name: "Route Handler 请求同源路径时报错",
      file: "app/api/probe/route.ts",
      url: `"/api/tasks"`,
      reported: 1,
    },
    {
      name: "Server Component 用模板字符串拼的同源路径也报错",
      file: "app/[locale]/probe/page.tsx",
      url: "`/api/tasks/${id}`",
      reported: 1,
    },
    {
      name: "数据层和 Server Action 请求同源路径时报错",
      file: "features/ui-catalog/api/probe-action.ts",
      directive: `"use server";\n\n`,
      url: `"/api/tasks"`,
      reported: 1,
    },
    {
      name: "feature 的 server/ 里的模块请求同源路径时报错",
      file: "features/ui-catalog/server/probe.ts",
      url: `"/api/tasks"`,
      reported: 1,
    },
    {
      name: "feature 的 server.ts 入口请求同源路径时报错",
      file: "features/ui-catalog/server.ts",
      url: `"/api/tasks"`,
      reported: 1,
    },
    {
      name: "app/ 以外 import 了 server-only 的模块请求同源路径时报错",
      file: "lib/probe.ts",
      directive: `import "server-only";\n\n`,
      url: `"/api/tasks"`,
      reported: 1,
    },
    {
      name: "proxy.ts 请求同源路径时报错",
      file: "proxy.ts",
      url: `"/api/tasks"`,
      reported: 1,
    },
    {
      name: "instrumentation.ts 请求同源路径时报错",
      file: "instrumentation.ts",
      url: `"/api/tasks"`,
      reported: 1,
    },
    {
      name: "服务端请求其他服务的完整 URL 不报",
      file: "features/ui-catalog/server/probe.ts",
      url: `"https://api.example.com/v1/items"`,
      reported: 0,
    },
    {
      name: "Client Component 请求同源路径不报",
      file: "app/[locale]/probe/client.tsx",
      directive: `"use client";\n\n`,
      url: `"/api/tasks"`,
      reported: 0,
    },
    {
      name: "feature 的浏览器请求模块不报",
      file: "features/ui-catalog/api/get-probe.ts",
      url: `"/api/tasks"`,
      reported: 0,
    },
  ]) {
    test(name, async () => {
      const source = `${directive}import { z } from "zod";

import { fetchApi } from "@/lib/request/fetch";

export async function probe(id: string) {
  return ${request(url, raw)};
}
`;
      const [result] = await eslint.lintText(source, {
        filePath: join(project, file),
      });
      expect(
        result.messages.filter(
          ({ ruleId }) => ruleId === "data-flow/no-server-self-fetch",
        ),
        JSON.stringify(result.messages, null, 2),
      ).toHaveLength(reported);
    });
  }
});

describe("浏览器里的裸 fetch 请求本 app 的路径时以 BASE_PATH 开头", () => {
  const eslint = new ESLint({
    cwd: project,
    overrideConfig: { rules: { "import/no-cycle": "off" } },
  });
  for (const {
    name,
    file = "features/ui-catalog/api/get-probe.ts",
    body,
    reported,
  } of [
    {
      name: "字面量的同源路径报错",
      body: `return fetch("/api/tasks");`,
      reported: 1,
    },
    {
      name: "模板字符串的同源路径报错",
      body: "return fetch(`/api/tasks/${id}`);",
      reported: 1,
    },
    {
      name: "先存进 const 再传给 fetch 的同源路径也报错",
      body: "const url = `/api/tasks/${id}/logs` as const;\n  return fetch(url);",
      reported: 1,
    },
    {
      name: "以 BASE_PATH 开头的路径不报",
      body: "const url = `${BASE_PATH}/api/tasks/${id}/logs` as const;\n  return fetch(url);",
      reported: 0,
    },
    {
      name: "其他服务的完整 URL 和协议相对 URL 不报",
      body: `await fetch("https://api.example.com/v1/items");\n  return fetch("//cdn.example.com/a.glb");`,
      reported: 0,
    },
    {
      name: "服务端文件交给 no-server-self-fetch，这条不报",
      file: "features/ui-catalog/server/probe.ts",
      body: `return fetch("/api/tasks");`,
      reported: 0,
    },
  ]) {
    test(name, async () => {
      const source = `import { BASE_PATH } from "@/lib/base-path";

export async function probe(id: string) {
  void BASE_PATH;
  ${body}
}
`;
      const [result] = await eslint.lintText(source, {
        filePath: join(project, file),
      });
      expect(
        result.messages.filter(
          ({ ruleId }) => ruleId === "data-flow/raw-fetch-base-path",
        ),
        JSON.stringify(result.messages, null, 2),
      ).toHaveLength(reported);
    });
  }
});

describe("数据的文件约定", () => {
  const eslint = new ESLint({ cwd: project });
  const action = "export async function probeAction() {}\n";
  for (const { name, rule, file, source, reported } of [
    {
      name: "-action 文件没有以 use server 开头报错",
      rule: "data-flow/action-module",
      file: "features/example/api/update-probe-action.ts",
      source: action,
      reported: ["missing"],
    },
    {
      name: "use server 不在第一句也报错",
      rule: "data-flow/action-module",
      file: "features/example/api/update-probe-action.ts",
      source: `import { z } from "zod";\n"use server";\n${action}`,
      reported: ["missing"],
    },
    {
      name: "以 use server 开头的 -action 文件不报",
      rule: "data-flow/action-module",
      file: "features/example/api/update-probe-action.ts",
      source: `"use server";\n\n${action}`,
      reported: [],
    },
    {
      name: "api/ 里的其他文件不要求 use server",
      rule: "data-flow/action-module",
      file: "features/example/api/update-probe.ts",
      source: action,
      reported: [],
    },
    {
      name: "-search-params 文件从 nuqs 引入报错",
      rule: "data-flow/search-params-imports",
      file: "features/example/utils/probe-search-params.ts",
      source: `import { parseAsString } from "nuqs";\nexport const parsers = { q: parseAsString };\n`,
      reported: ["client"],
    },
    {
      name: "-search-params 文件从 nuqs/server 引入、从 nuqs 只引类型不报",
      rule: "data-flow/search-params-imports",
      file: "features/example/utils/probe-search-params.ts",
      source: `import type { Nullable } from "nuqs";\nimport { parseAsString } from "nuqs/server";\nexport const parsers = { q: parseAsString };\nexport type Probe = Nullable<{ q: string }>;\n`,
      reported: [],
    },
    {
      name: "Client Component 从 nuqs 引入不报",
      rule: "data-flow/search-params-imports",
      file: "features/example/components/probe.tsx",
      source: `"use client";\nimport { useQueryStates } from "nuqs";\nexport const useProbe = useQueryStates;\n`,
      reported: [],
    },
    {
      name: "types/ 里的 schema 用 z.date()、z.coerce.date()、z.bigint()、optional、transform 都报错",
      rule: "data-flow/json-native-schema",
      file: "features/example/types/probe.ts",
      source: `import { z } from "zod";\nexport const probeSchema = z.object({\n  a: z.date(),\n  b: z.coerce.date(),\n  c: z.bigint(),\n  d: z.string().optional(),\n  e: z.string().transform((value) => value.length),\n});\n`,
      reported: ["type", "type", "type", "optional", "transform"],
    },
    {
      name: "types/ 里 JSON 原生的 schema 不报，包括校验字符串的 z.iso.date()",
      rule: "data-flow/json-native-schema",
      file: "features/example/types/probe.ts",
      source: `import { z } from "zod";\nexport const probeSchema = z.object({\n  createdAt: z.number(),\n  dueDate: z.iso.date(),\n  note: z.string().nullable(),\n});\n`,
      reported: [],
    },
    {
      name: "types/ 里没有 import zod 的文件，同名方法不报",
      rule: "data-flow/json-native-schema",
      file: "features/example/types/probe.ts",
      source: `declare const list: { transform(): number };\nexport const size = list.transform();\n`,
      reported: [],
    },
    {
      name: "types/ 以外的 schema 不查",
      rule: "data-flow/json-native-schema",
      file: "features/example/api/create-probe-schema.ts",
      source: `import { z } from "zod";\nexport const inputSchema = z.object({ note: z.string().optional() });\n`,
      reported: [],
    },
  ]) {
    test(name, async () => {
      const [result] = await eslint.lintText(source, {
        filePath: join(project, file),
      });
      expect(
        result.messages
          .filter(({ ruleId }) => ruleId === rule)
          .map(({ messageId }) => messageId),
        JSON.stringify(result.messages, null, 2),
      ).toStrictEqual(reported);
    });
  }
});

describe("feature 的 server/ 和 server.ts 都 import server-only", () => {
  const eslint = new ESLint({ cwd: project });
  const plain = "export const probe = 1;\n";
  for (const { name, file, source = plain, reported } of [
    {
      name: "server/ 里没有 import server-only 的模块报错",
      file: "features/ui-catalog/server/probe.ts",
      reported: 1,
    },
    {
      name: "server.ts 入口没有 import server-only 报错",
      file: "features/ui-catalog/server.ts",
      reported: 1,
    },
    {
      name: "import 了 server-only 的模块不报",
      file: "features/ui-catalog/server/probe.ts",
      source: `import "server-only";\n\n${plain}`,
      reported: 0,
    },
    {
      name: "测试不报",
      file: "features/ui-catalog/server/probe.db.test.ts",
      reported: 0,
    },
    {
      name: "import 了 vitest 的测试 helper 不报",
      file: "features/ui-catalog/server/probe-test-helpers.ts",
      source: `import { expect } from "vitest";\n\nexport const check = expect;\n`,
      reported: 0,
    },
    {
      name: "在 Next 之外加载的 migration 不报",
      file: "features/ui-catalog/server/migrations.mts",
      reported: 0,
    },
    {
      name: "feature 的其他层不查",
      file: "features/ui-catalog/utils/probe.ts",
      reported: 0,
    },
  ]) {
    test(name, async () => {
      const [result] = await eslint.lintText(source, {
        filePath: join(project, file),
      });
      expect(
        result.messages.filter(
          ({ ruleId }) => ruleId === "data-flow/server-only",
        ),
        JSON.stringify(result.messages, null, 2),
      ).toHaveLength(reported);
    });
  }
});

describe("应用代码只包括「Layers」表里的目录", () => {
  const eslint = new ESLint({ cwd: project });
  const envRead = "export const url = process.env.PROBE_URL;\n";
  const ruleIds = async (file) => {
    const [result] = await eslint.lintText(envRead, {
      filePath: join(project, file),
    });
    return result.messages.map(({ ruleId }) => ruleId);
  };

  test("Layers 里的目录受应用代码的限制", async () => {
    expect(await ruleIds("lib/probe.ts")).toContain("no-restricted-syntax");
  });

  test("派生项目自己加的目录，比如 tests/，不受应用代码的限制", async () => {
    expect(await ruleIds("tests/http/probe.ts")).not.toContain(
      "no-restricted-syntax",
    );
  });

  test("应用代码之外名为 components 的目录不套组件入口的限制", async () => {
    expect(await ruleIds("e2e/components/task-row/index.ts")).not.toContain(
      "no-restricted-syntax",
    );
  });
});

describe("页面上的 HTML 只由 React 渲染", () => {
  const eslint = new ESLint({ cwd: project });
  for (const { name, source, rule } of [
    {
      name: "dangerouslySetInnerHTML 报错，传给组件也报",
      source: `export function Probe({ html }: { html: string }) {\n  return <Panel dangerouslySetInnerHTML={{ __html: html }} />;\n}\n`,
      rule: "react/no-danger",
    },
    {
      name: "javascript: URL 报错",
      source: `export function Probe() {\n  return <a href="javascript:void(0)" />;\n}\n`,
      rule: "no-script-url",
    },
    {
      name: "写进对象再展开的 dangerouslySetInnerHTML 也报错",
      source: `export function Probe({ html }: { html: string }) {\n  const props = { dangerouslySetInnerHTML: { __html: html } };\n  return <div {...props} />;\n}\n`,
      rule: "security/raw-html",
    },
  ]) {
    test(name, async () => {
      const [result] = await eslint.lintText(source, {
        filePath: join(project, "components/probe.tsx"),
      });
      expect(
        result.messages.map(({ ruleId }) => ruleId),
        JSON.stringify(result.messages, null, 2),
      ).toContain(rule);
    });
  }
});

describe("派生项目的 eslint.config.project.mjs 接在 template 的配置后面", () => {
  let fixture;

  beforeAll(() => {
    fixture = createConfigFixture();
    // better-tailwindcss 按 app/globals.css 读项目主题。
    mkdirSync(join(fixture, "app"));
    copyFileSync(
      join(project, "app/globals.css"),
      join(fixture, "app/globals.css"),
    );
    writeFileSync(
      join(fixture, "eslint.config.project.mjs"),
      `import { SOURCE_GLOB } from "./scripts/eslint/imports.mjs";
import { TAILWIND_CLASS_RESTRICTIONS } from "./scripts/eslint/tailwind-classes.mjs";

export default [
  { files: ["probe/**"], rules: { "no-console": "error" } },
  {
    files: [SOURCE_GLOB],
    rules: {
      "architecture/wrapper-imports": ["error", { uiLibraries: ["probe-ui"] }],
    },
  },
  {
    files: ["components/**"],
    rules: {
      "better-tailwindcss/no-restricted-classes": [
        "error",
        {
          restrict: [
            ...TAILWIND_CLASS_RESTRICTIONS,
            { pattern: "^text-sm$", message: "PROBE" },
          ],
        },
      ],
    },
  },
];
`,
    );
  });

  afterAll(() => {
    rmSync(fixture, { recursive: true, force: true });
  });

  test("项目配置里的规则对它的文件生效", async () => {
    const eslint = new ESLint({ cwd: fixture });
    const [result] = await eslint.lintText("console.log(1);\n", {
      filePath: join(fixture, "probe/run.mjs"),
    });
    expect(
      result.messages.map(({ ruleId }) => ruleId),
      JSON.stringify(result.messages, null, 2),
    ).toContain("no-console");
  });

  test("项目追加 Tailwind 限制后 template 的限制照旧", async () => {
    const eslint = new ESLint({ cwd: fixture });
    const [result] = await eslint.lintText(
      `export const probe = <div className="bg-red-500 text-sm" />;\n`,
      { filePath: join(fixture, "components/probe.tsx") },
    );
    expect(
      result.messages
        .filter(
          ({ ruleId }) => ruleId === "better-tailwindcss/no-restricted-classes",
        )
        .map(({ message }) =>
          message.includes("Tailwind palette color") ? "palette" : message,
        ),
      JSON.stringify(result.messages, null, 2),
    ).toStrictEqual(["palette", "PROBE"]);
  });

  test("项目追加的 UI 库和 template 的一样只能由 components/ui/ 引用", async () => {
    const eslint = new ESLint({ cwd: fixture });
    const source = `import { Probe } from "probe-ui";\nimport { Viewer } from "probe-ui/viewer";\nimport { toast } from "sonner";\n\nexport const probe = [Probe, Viewer, toast];\n`;
    const reported = async (file) => {
      const [result] = await eslint.lintText(source, {
        filePath: join(fixture, file),
      });
      return result.messages
        .filter(({ ruleId }) => ruleId === "architecture/wrapper-imports")
        .map(({ line }) => line);
    };
    expect(await reported("lib/probe.ts")).toStrictEqual([1, 2, 3]);
    expect(await reported("components/ui/probe.tsx")).toStrictEqual([]);
  });
});

// 用项目自己的配置 lint 源码片段；经 messagesFor 的用例共用这一个实例。
const projectLinter = new ESLint({ cwd: project });

/**
 * 用项目配置 lint 一段源码，返回 ruleIds 里那些规则的报告；以 / 结尾的一项代表整个插件，比如 "jsx-a11y/"。
 * file 用真实存在的路径：import/no-cycle 定位不了不在磁盘上的文件。源码没有 import 时它不用定位，路径可以不存在。
 */
async function messagesFor(file, source, ruleIds) {
  const [result] = await projectLinter.lintText(source, {
    filePath: join(project, file),
  });
  expect(result.fatalErrorCount).toBe(0);
  return result.messages.filter(({ ruleId }) =>
    ruleIds.some((id) =>
      id.endsWith("/") ? ruleId?.startsWith(id) : ruleId === id,
    ),
  );
}

describe("Tailwind class 按项目主题检查规范写法、颜色、圆角和过渡", () => {
  const eslint = new ESLint({ cwd: project });
  const file = "components/tailwind-classes.tsx";
  const filePath = join(project, file);
  const restrictedLines = async (source) =>
    (
      await messagesFor(file, source, [
        "better-tailwindcss/no-restricted-classes",
      ])
    ).map(({ line }) => line);

  // 每个 class 渲染在自己的一行，按行号认出 no-restricted-classes 报的是哪个：恰好是 restricted 里的那些。
  async function expectRestricted(restricted, allowed) {
    const classes = [...restricted, ...allowed];
    const source = `export const panels = [\n${classes
      .map((className) => `  <div className="${className}" />,`)
      .join("\n")}\n];\n`;
    expect(
      (await restrictedLines(source)).map((line) => classes[line - 2]),
    ).toStrictEqual(restricted);
  }

  test("按项目主题和 16px 根字号改成规范写法", async () => {
    // h-control-sm 只在 app/globals.css 里定义，用来确认插件读到了项目主题。
    const source = `export const panel = <div className="h-control-sm lg:max-h-[520px]" />;\n`;
    const [before] = await eslint.lintText(source, { filePath });
    expect(
      before.messages.map(({ ruleId, severity }) => ({ ruleId, severity })),
      JSON.stringify(before.messages, null, 2),
    ).toStrictEqual([
      { ruleId: "better-tailwindcss/enforce-canonical-classes", severity: 2 },
    ]);
    const [after] = await new ESLint({ cwd: project, fix: true }).lintText(
      source,
      { filePath },
    );
    expect(after.messages).toStrictEqual([]);
    expect(after.output).toBe(
      `export const panel = <div className="h-control-sm lg:max-h-130" />;\n`,
    );
  });

  // 第一列是源码里 className 的写法。
  test.each([
    ['"pxx-2"', "no-unknown-classes"],
    ['"p-2 p-4"', "no-conflicting-classes"],
    ['"flex-shrink-0"', "no-deprecated-classes"],
    ["{`p-${size}`}", "no-concatenated-classes"],
  ])("className=%s 报 %s", async (value, rule) => {
    const source = `export function Probe({ size }: { size: number }) {\n  return <div className=${value} data-size={size} />;\n}\n`;
    expect(
      (await messagesFor(file, source, ["better-tailwindcss/"])).map(
        ({ ruleId }) => ruleId,
      ),
    ).toContain(`better-tailwindcss/${rule}`);
  });

  test("从子目录运行也按项目主题检查", async () => {
    const source = `export const panel = <div className="h-control-sm lg:max-h-[520px]" />;\n`;
    const [result] = await new ESLint({
      cwd: join(project, "components"),
    }).lintText(source, { filePath });
    expect(
      result.messages.map(({ ruleId, severity }) => ({ ruleId, severity })),
      JSON.stringify(result.messages, null, 2),
    ).toStrictEqual([
      { ruleId: "better-tailwindcss/enforce-canonical-classes", severity: 2 },
    ]);
  });

  test("颜色只能用语义 token 和黑白，圆角只能用内置或项目 token", async () => {
    await expectRestricted(
      [
        "bg-red-500",
        "hover:text-zinc-400/50",
        // Tailwind 4.2 新增的调色板，确认调色板名是从 tailwindcss 读出来的。
        "border-t-mauve-200",
        "bg-red-500!",
        "bg-[#c83d21]",
        "shadow-[0_0_0_1px_#000_inset]",
        "shadow-[0_2px_4px_rgb(0_0_0/0.2)]",
        "bg-[oklch(0.6_0.2_30)]",
        "shadow-[0_0_0_1px_var(--color-zinc-200)]",
        "hover:bg-[#c83d21]/50",
        "rounded-[5px]",
        "md:rounded-tl-(--my-radius)",
      ],
      [
        "bg-primary text-primary-foreground border-border",
        "bg-white text-black/65",
        "shadow-[0_0_0_1px_var(--color-border)]",
        "fill-[url(#fade)]",
        "[&_#abc]:hidden",
        "rounded rounded-sm rounded-2xl rounded-full",
        "rounded-control rounded-t-panel",
        "rounded-[inherit]",
        "text-sm border-2 ring-2 bg-transparent fill-current",
      ],
    );
  });

  test("过渡列表里的 transform、transition-all 和 ease-in 被拒绝", async () => {
    await expectRestricted(
      [
        "transition-[opacity,transform]",
        "data-open:transition-[transform]",
        "md:transition-all",
        "hover:ease-in",
      ],
      [
        "transition-transform",
        "transition-[opacity,scale]",
        "transition-[transform-origin]",
        "ease-out",
        "ease-in-out",
      ],
    );
  });

  test("常量、查找表、xxxClassName prop 和函数式 className 里的 class 也检查", async () => {
    const source = `declare function Popup(props: {
  triggerClassName?: string;
  className?: unknown;
}): null;

const itemClassName = "bg-red-500";
export const ROW_CLASSES = { open: "bg-red-500" };
export const LABEL_CLASS = "bg-red-500";

export function Probe({ open }: { open: boolean }) {
  return (
    <>
      <div className={itemClassName} />
      <Popup triggerClassName={open ? "bg-red-500" : "bg-primary"} />
      <Popup
        className={(state: { open: boolean }) =>
          state.open ? "bg-red-500" : ""
        }
      />
    </>
  );
}
`;
    expect(await restrictedLines(source)).toStrictEqual(
      source
        .split("\n")
        .flatMap((line, index) =>
          line.includes("bg-red-500") ? [index + 1] : [],
        ),
    );
  });
});

describe("e2e 整页加载之后先确认页面已经 hydrate 再操作", () => {
  const eslint = new ESLint({ cwd: project });
  const filePath = join(project, "e2e/act-after-ready.spec.ts");
  const lint = async (body) => {
    const source = `import { expect, type Page, test } from "@playwright/test";\n\ndeclare function openTask(page: Page): Promise<void>;\n\ntest("case", async ({ page }) => {\n${body}\n});\n`;
    const [result] = await eslint.lintText(source, { filePath });
    return (
      result.messages
        .filter(({ ruleId }) => ruleId === "e2e/act-after-ready")
        // 正文从源码第 6 行开始，换算成正文里的行号。
        .map(({ line }) => line - 5)
    );
  };

  test("goto 或 reload 之后直接操作被拒绝", async () => {
    expect(
      await lint(
        `  await page.goto("/a");\n  const button = page.getByRole("button");\n  await button.click();`,
      ),
    ).toStrictEqual([3]);
    expect(
      await lint(
        `  await page.reload();\n  await page.getByLabel("名称").fill("x");`,
      ),
    ).toStrictEqual([2]);
    expect(
      await lint(
        `  await page.goto("/a");\n  await page.getByLabel("封面").setInputFiles("cover.png");`,
      ),
    ).toStrictEqual([2]);
  });

  test("先用 expect 或 helper 确认之后可以操作", async () => {
    expect(
      await lint(
        `  await page.goto("/a");\n  await expect(page.getByText("已加载")).toBeVisible();\n  await page.getByRole("button").click();`,
      ),
    ).toStrictEqual([]);
    expect(
      await lint(
        `  await openTask(page);\n  await page.getByRole("button").click();`,
      ),
    ).toStrictEqual([]);
  });

  test("回调里的操作不算在 goto 之后立即执行", async () => {
    expect(
      await lint(
        `  await page.goto("/a");\n  page.on("load", () => void page.getByRole("button").click());\n  await expect(page.getByText("已加载")).toBeVisible();`,
      ),
    ).toStrictEqual([]);
  });
});

// 例外对象只去掉或追加一条限制，其余全局的限制照旧：source 都带上 axios，数的是 no-restricted-imports 的报告条数。
async function restrictedImportCount(file, source) {
  return (await messagesFor(file, source, ["no-restricted-imports"])).length;
}

describe("文案只经 ClientMessages 下发，ClientMessages 自己和单元测试除外", () => {
  const source = `import axios from "axios";
import { NextIntlClientProvider } from "next-intl";

export const probe = [axios, NextIntlClientProvider];
`;
  test.each([
    ["components/probe.tsx", 2],
    ["lib/i18n/probe.tsx", 1],
    ["components/probe.test.tsx", 1],
  ])("%s 报 %i 条", async (file, count) => {
    expect(await restrictedImportCount(file, source)).toBe(count);
  });
});

describe("e2e 的 test 和 expect 从 e2e/test.ts 引入", () => {
  const source = `import { test } from "@playwright/test";
import axios from "axios";

export const probe = [axios, test];
`;
  test.each([
    ["e2e/probe.spec.ts", 2],
    ["e2e/test.ts", 1],
  ])("%s 报 %i 条", async (file, count) => {
    expect(await restrictedImportCount(file, source)).toBe(count);
  });
});

const RESTRICTION_NAMES = [
  ["Show a date or time", "date-time"],
  [
    "Call useTranslations() and getTranslations() without a namespace",
    "translator-namespace",
  ],
  ["List public API", "component-entry"],
  ["Read environment variables", "env"],
  ["Native <", "native-element"],
  ["A control role", "control-role"],
  ["Give a trigger or control one interactive element", "nested-interactive"],
  ["Give a link one interactive element", "nested-link"],
];

// 每条 no-restricted-syntax 报告，按它来自哪条限制命名。
async function restricted(file, source) {
  return (await messagesFor(file, source, ["no-restricted-syntax"])).map(
    ({ message }) =>
      RESTRICTION_NAMES.find(([prefix]) => message.startsWith(prefix))?.[1] ??
      message,
  );
}

describe("日期和时间只在 components/date-time.tsx 里格式化", () => {
  const clientDateTime = `"use client";

import { useFormatter } from "next-intl";

export function Probe({ at }: { at: number }) {
  const format = useFormatter();
  return <p>{format.dateTime(at)}</p>;
}
`;
  for (const { name, file, source, reported } of [
    {
      name: "format.dateTime in a Client Component is reported",
      file: "features/ui-catalog/components/example-list/index.tsx",
      source: clientDateTime,
      reported: ["date-time"],
    },
    {
      name: "a component entry is under the date restriction and its own",
      file: "components/locale-switcher/index.tsx",
      source: `${clientDateTime}export * from "./locale-items";\n`,
      reported: ["date-time", "component-entry"],
    },
    {
      name: "getFormatter().dateTimeRange in a Server Component is reported",
      file: "app/[locale]/page.tsx",
      source: `import { getFormatter } from "next-intl/server";

export default async function Probe() {
  const format = await getFormatter();
  return <p>{format.dateTimeRange(0, 1)}</p>;
}
`,
      reported: ["date-time"],
    },
    {
      name: "Intl.DateTimeFormat is reported",
      file: "lib/cn.ts",
      source: `export const probe = (at: number) => new Intl.DateTimeFormat("en").format(at);\n`,
      reported: ["date-time"],
    },
    {
      name: "Date 和数字的 toLocale*String、toDateString、toTimeString 被报告",
      file: "features/ui-catalog/components/example-list/index.tsx",
      source: `export const probe = (at: Date, n: number) => [
  at.toLocaleDateString(),
  at.toLocaleTimeString(),
  at.toLocaleString(),
  at.toDateString(),
  at.toTimeString(),
  n.toLocaleString(),
];
`,
      reported: Array(6).fill("date-time"),
    },
    {
      name: "relative times and numbers still format anywhere",
      file: "features/ui-catalog/components/example-list/index.tsx",
      source: `"use client";

import { useFormatter } from "next-intl";

export function Probe({ at, count }: { at: number; count: number }) {
  const format = useFormatter();
  return (
    <p>
      {format.relativeTime(at)} {format.number(count)}
    </p>
  );
}
`,
      reported: [],
    },
    {
      name: "components/date-time.tsx formats them",
      file: "components/date-time.tsx",
      source: clientDateTime,
      reported: [],
    },
  ]) {
    test(name, async () => {
      expect(await restricted(file, source)).toStrictEqual(reported);
    });
  }

  test("toLocaleString 的消息日期和数字都说，和日期的消息不同；toISOString 不报", async () => {
    const messages = await messagesFor(
      "features/ui-catalog/components/example-list/index.tsx",
      `export const probe = (at: Date) => [
  at.toLocaleString(),
  at.toDateString(),
  at.toISOString(),
];
`,
      ["no-restricted-syntax"],
    );
    expect(messages.map(({ line, message }) => [line, message])).toStrictEqual([
      [
        2,
        "Show a date or time with <DateTime> from @/components/date-time, and a number with next-intl's useFormatter() or getFormatter(): toLocaleString formats in the runtime's locale and time zone, which differ between the server and the browser. See .claude/rules/i18n.md.",
      ],
      [
        3,
        "Show a date or time with <DateTime> from @/components/date-time, which renders it in the browser in the computer's time zone. See .claude/rules/i18n.md.",
      ],
    ]);
  });
});

describe("翻译函数不按 namespace 取", () => {
  for (const { name, file, source, reported } of [
    {
      name: "useTranslations 传 namespace 时报错",
      file: "features/ui-catalog/components/example-list/index.tsx",
      source: `"use client";

import { useTranslations } from "next-intl";

export function Probe() {
  const t = useTranslations("task");
  return <p>{t("comments.empty")}</p>;
}
`,
      reported: ["translator-namespace"],
    },
    {
      name: "getTranslations 传 namespace 时报错，对象写法也一样",
      file: "app/[locale]/page.tsx",
      source: `import { getTranslations } from "next-intl/server";

export async function probe(locale: string) {
  const a = await getTranslations("app");
  const b = await getTranslations({ locale, namespace: "app" });
  return [a("home.title"), b("home.title")];
}
`,
      reported: ["translator-namespace", "translator-namespace"],
    },
    {
      name: "不传 namespace、key 写完整路径时不报",
      file: "app/[locale]/page.tsx",
      source: `import { getTranslations } from "next-intl/server";

export async function probe(locale: string) {
  const a = await getTranslations();
  const b = await getTranslations({ locale });
  return [a("app.home.title"), b("app.home.title")];
}
`,
      reported: [],
    },
  ]) {
    test(name, async () => {
      expect(await restricted(file, source)).toStrictEqual(reported);
    });
  }
});

describe("每个 key 的第一段是文件 owner 的 namespace", () => {
  async function keyProblems(file, source) {
    return (await messagesFor(file, source, ["i18n/message-keys"])).map(
      ({ messageId, line }) => [messageId, line],
    );
  }

  for (const { name, file, source, reported } of [
    {
      name: "feature 只读自己的 key；模板字面量和条件表达式的每个分支都按前缀查",
      file: "features/ui-catalog/components/example-list/index.tsx",
      source: `"use client";

import { useTranslations } from "next-intl";

export function Probe({ status, wide }: { status: string; wide: boolean }) {
  const t = useTranslations();
  return (
    <p>
      {t("ui-catalog.examples.title")}
      {t(\`ui-catalog.header.theme.\${status}\`)}
      {t(wide ? "ui-catalog.examples.title" : "ui.dialog.close")}
      {t.rich("app.name")}
    </p>
  );
}
`,
      reported: [
        ["owner", 11],
        ["owner", 12],
      ],
    },
    {
      name: "接收 Translator 的函数按所在文件的 owner 查",
      file: "features/ui-catalog/utils/example-source.ts",
      source: `import type { Translator } from "@/lib/i18n/translator";

export const probe = (t: Translator, key: string) => [
  t("ui-catalog.header.brand"),
  t("task.queryState.loading"),
  t(key),
];
`,
      reported: [
        ["owner", 5],
        ["dynamic", 6],
      ],
    },
    {
      name: "app 读 app 的 key，components 读 ui 的 key",
      file: "components/locale-switcher/index.tsx",
      source: `"use client";

import { useTranslations } from "next-intl";

export function Probe() {
  const t = useTranslations();
  return <p>{t("ui.localeSwitcher.label")}{t("app.tasks.title")}</p>;
}
`,
      reported: [["owner", 7]],
    },
    {
      name: "没有 owner 的文件不读文案",
      file: "lib/request/fetch.ts",
      source: `import { getTranslations } from "next-intl/server";

export async function probe() {
  const t = await getTranslations();
  return t("app.tasks.title");
}
`,
      reported: [["noOwner", 5]],
    },
  ]) {
    test(name, async () => {
      expect(await keyProblems(file, source)).toStrictEqual(reported);
    });
  }
});

describe("应用的环境变量只通过 lib/env.ts 读", () => {
  for (const { name, file, source, reported } of [
    {
      name: "feature 的服务端代码直接读应用的变量时报错",
      file: "features/ui-catalog/server/get-cached-example-sources.ts",
      source: `export const url = process.env.DATABASE_URL;\n`,
      reported: ["env"],
    },
    {
      name: "按变量名取、解构、整个传出去都报错",
      file: "features/ui-catalog/server/get-cached-example-sources.ts",
      source: `const name = "DATABASE_URL";
export const byName = process.env[name];
export const { STORAGE_BUCKET } = process.env;
export const all = Object.keys(process.env);
`,
      reported: ["env", "env", "env"],
    },
    {
      name: "Node 和 Next 定义的变量可以直接读，NEXT_PUBLIC_ 除外",
      file: "features/ui-catalog/components/example-list/index.tsx",
      source: `export const dev = process.env.NODE_ENV === "development";
export const node = process.env.NEXT_RUNTIME === "nodejs";
export const devServer = Boolean(process.env.__NEXT_DEV_SERVER);
export const publicId = process.env.NEXT_PUBLIC_ANALYTICS_ID;
`,
      reported: ["env"],
    },
    ...["proxy.ts", "instrumentation.ts"].map((file) => ({
      name: `根目录的 ${file} 也受限制`,
      file,
      source: `export const url = process.env.DATABASE_URL;\n`,
      reported: ["env"],
    })),
    {
      name: "lib/env.ts 可以读，其他限制照旧",
      file: "lib/env.ts",
      source: `export const url = process.env.DATABASE_URL;
export const probe = (at: number) => new Intl.DateTimeFormat("en").format(at);
`,
      reported: ["date-time"],
    },
    {
      name: "components/date-time.tsx 仍然不能直接读",
      file: "components/date-time.tsx",
      source: `export const url = process.env.DATABASE_URL;\n`,
      reported: ["env"],
    },
  ]) {
    test(name, async () => {
      expect(await restricted(file, source)).toStrictEqual(reported);
    });
  }
});

describe("React 19 写法和 effect 清理由 @eslint-react 检查", () => {
  // 报告的 @eslint-react 规则，去掉前缀。
  async function reactRules(source) {
    return (
      await messagesFor(
        "features/ui-catalog/components/example-list/index.tsx",
        source,
        ["@eslint-react/"],
      )
    ).map(({ ruleId }) => ruleId.slice("@eslint-react/".length));
  }

  for (const { name, source, reported } of [
    {
      name: "forwardRef 报错，经 namespace import 调用也报",
      source: `import * as React from "react";
import { forwardRef } from "react";

export const A = forwardRef<HTMLInputElement>(function A(_, ref) {
  return <input ref={ref} />;
});
export const B = React.forwardRef<HTMLInputElement>(function B(_, ref) {
  return <input ref={ref} />;
});
`,
      reported: ["no-forward-ref", "no-forward-ref"],
    },
    {
      name: "<Context.Provider> 和 useContext 报错",
      source: `import { createContext, type ReactNode, useContext } from "react";

const ThemeContext = createContext("light");

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>;
}
export function useTheme() {
  return useContext(ThemeContext);
}
`,
      reported: ["no-context-provider", "no-use-context"],
    },
    {
      name: "createContext 的结果不以 Context 结尾时报错",
      source: `import { createContext } from "react";

export const Theme = createContext("light");
`,
      reported: ["naming-convention-context-name"],
    },
    {
      name: "<Context value> 和 use(Context) 不报，组件库的 X.Provider 也不报",
      source: `import { Tooltip } from "@base-ui/react/tooltip";
import { createContext, type ReactNode, use } from "react";

const ThemeContext = createContext("light");

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext value="dark">
      <Tooltip.Provider>{children}</Tooltip.Provider>
    </ThemeContext>
  );
}
export function useTheme() {
  return use(ThemeContext);
}
`,
      reported: [],
    },
    {
      name: "react-dom 的 useFormState 报错",
      source: `import { useFormState } from "react-dom";

export function useSave(action: (state: number) => number) {
  return useFormState(action, 0);
}
`,
      reported: ["dom-no-use-form-state"],
    },
    {
      name: "原生 button 不写 type 时报错",
      source: `export function Buttons() {
  return (
    <>
      <button>A</button>
      <button type="button">B</button>
    </>
  );
}
`,
      reported: ["dom-no-missing-button-type"],
    },
    {
      name: "effect 里的监听和定时器没在 cleanup 里撤掉时报错",
      source: `import { useEffect } from "react";

export function useLeaks(
  element: Element,
  onResize: () => void,
  tick: () => void,
) {
  useEffect(() => {
    window.addEventListener("resize", onResize);
    setInterval(tick, 1000);
    setTimeout(tick, 1000);
    new ResizeObserver(onResize).observe(element);
    new IntersectionObserver(tick).observe(element);
  }, [element, onResize, tick]);
}
`,
      reported: [
        "web-api-no-leaked-event-listener",
        "web-api-no-leaked-interval",
        "web-api-no-leaked-timeout",
        "web-api-no-leaked-resize-observer",
        "web-api-no-leaked-intersection-observer",
      ],
    },
    {
      name: "在 cleanup 里撤掉的监听和定时器不报",
      source: `import { useEffect } from "react";

export function useCleanedUp(onResize: () => void, tick: () => void) {
  useEffect(() => {
    window.addEventListener("resize", onResize);
    const id = setInterval(tick, 1000);
    return () => {
      window.removeEventListener("resize", onResize);
      clearInterval(id);
    };
  }, [onResize, tick]);
}
`,
      reported: [],
    },
  ]) {
    test(name, async () => {
      expect(await reactRules(source)).toStrictEqual(reported);
    });
  }
});

describe("React Compiler 跳过的写法和可访问性检查是 error", () => {
  const file = "features/ui-catalog/components/example-list/index.tsx";

  // nextVitals 把这些规则设为 warn，eslint.config.mjs 提成 error：每条一个最小的违例片段。
  test.each([
    ["jsx-a11y/alt-text", '<img src="/probe.png" />'],
    ["jsx-a11y/aria-props", '<div aria-foo="x" />'],
    ["jsx-a11y/aria-proptypes", '<div aria-hidden="yes" />'],
    ["jsx-a11y/aria-unsupported-elements", '<meta aria-hidden="true" />'],
    ["jsx-a11y/role-has-required-aria-props", '<div role="checkbox" />'],
    ["jsx-a11y/role-supports-aria-props", '<li aria-checked="true" />'],
  ])("%s 报 error", async (rule, jsx) => {
    const messages = await messagesFor(file, `export const probe = ${jsx};\n`, [
      "jsx-a11y/",
    ]);
    expect(
      messages.map(({ ruleId, severity }) => ({ ruleId, severity })),
      JSON.stringify(messages, null, 2),
    ).toStrictEqual([{ ruleId: rule, severity: 2 }]);
  });

  test.each([
    [
      "react-hooks/incompatible-library",
      `import { useVirtualizer } from "@tanstack/react-virtual";

export function Probe({ count }: { count: number }) {
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => null,
    estimateSize: () => 10,
  });
  return <p>{virtualizer.getTotalSize()}</p>;
}
`,
    ],
    [
      "react-hooks/unsupported-syntax",
      `export function Probe({ code }: { code: string }) {
  return <p>{String(eval(code))}</p>;
}
`,
    ],
    [
      "react-hooks/exhaustive-deps",
      `import { useEffect } from "react";

export function useProbe(value: number) {
  useEffect(() => {
    console.info(value);
  }, []);
}
`,
    ],
  ])("%s 报 error", async (rule, source) => {
    const messages = await messagesFor(file, source, ["react-hooks/"]);
    expect(
      messages.map(({ ruleId, severity }) => ({ ruleId, severity })),
      JSON.stringify(messages, null, 2),
    ).toStrictEqual([{ ruleId: rule, severity: 2 }]);
  });

  test.each([
    [
      "react-hooks/rules-of-hooks",
      `export function useProbe(on: boolean) {
  if (on) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- 探针
    useProbe(false);
  }
}
`,
    ],
    [
      "react-hooks/exhaustive-deps",
      `import { useEffect } from "react";

export function useProbe(value: number) {
  useEffect(() => {
    console.info(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 探针
  }, []);
}
`,
    ],
  ])("禁用 %s 被拒绝", async (rule, source) => {
    expect(
      (
        await messagesFor(file, source, [
          "@eslint-community/eslint-comments/no-restricted-disable",
        ])
      ).map(({ message }) => message),
    ).toStrictEqual([expect.stringContaining(rule)]);
  });
});

describe("文件和函数过长时提醒检查职责", () => {
  const source = `export function Probe() {
  return (
    <>
${"      <p />\n".repeat(210)}    </>
  );
}
`;
  const maxLines = async (file) =>
    (
      await messagesFor(file, source, ["max-lines-per-function", "max-lines"])
    ).map(({ ruleId, severity }) => ({ ruleId, severity }));

  test.each([
    "features/ui-catalog/components/example-list/index.tsx",
    // max-lines 只豁免测试文件，路由段叫什么都照样检查。
    "app/[locale]/stories/page.tsx",
  ])("%s 报 max-lines 和 max-lines-per-function 的 warning", async (file) => {
    expect(await maxLines(file)).toStrictEqual([
      { ruleId: "max-lines-per-function", severity: 1 },
      { ruleId: "max-lines", severity: 1 },
    ]);
  });

  test("测试文件不报", async () => {
    expect(
      await maxLines(
        "features/ui-catalog/components/example-list/index.test.tsx",
      ),
    ).toStrictEqual([]);
  });
});

describe("组件写成具名的 function 声明", () => {
  async function declarationRules(file, source) {
    return (
      await messagesFor(file, source, [
        "react/function-component-definition",
        "import/no-default-export",
      ])
    ).map(({ ruleId }) => ruleId);
  }

  test("箭头函数、函数表达式组件和组件目录里的默认导出被拒绝", async () => {
    expect(
      await declarationRules(
        "features/ui-catalog/components/example-list/index.tsx",
        `export const Arrow = () => <p />;
export const Expression = function () {
  return <p />;
};
export default function Probe() {
  return <p />;
}
`,
      ),
    ).toStrictEqual([
      "react/function-component-definition",
      "react/function-component-definition",
      "import/no-default-export",
    ]);
  });

  test("框架按默认导出加载的文件可以默认导出", async () => {
    expect(
      await declarationRules(
        "app/[locale]/page.tsx",
        `export default function Page() {
  return <p />;
}
`,
      ),
    ).toStrictEqual([]);
  });
});

describe("agent 指令和 identifier 用英文写", () => {
  const eslint = new ESLint({ cwd: project });
  const englishOnly = async (file, source) => {
    const [result] = await eslint.lintText(source, {
      filePath: join(project, file),
    });
    expect(result.fatalErrorCount).toBe(0);
    return result.messages
      .filter(({ ruleId }) => ruleId === "writing-style/english-only")
      .map(({ line, column, message }) => [
        line,
        column,
        message.match(/found "(.+?)"/)[1],
      ]);
  };
  const markdown = [
    "---",
    "name: case",
    "description: 中文描述",
    "---",
    "",
    "Quote `王秀英` as test data, and name the 生成器.",
    "",
    "```md",
    "## 问题",
    "```",
    "",
    "<!-- 注释 -->",
    "",
    "| Term | Note |",
    "| ---- | ---- |",
    "| a | 表格，含标点 |",
    "",
  ].join("\n");

  test("code 以外的中文都报告，包括 frontmatter、HTML 注释和表格", async () => {
    expect(await englishOnly(".claude/rules/case.md", markdown)).toStrictEqual([
      [3, 14, "中文描述"],
      [6, 40, "生成器"],
      [12, 6, "注释"],
      [16, 7, "表格，含标点"],
    ]);
  });

  test("规则、skill、skill patch 和 docs/agents 都检查，其他 Markdown 不检查", async () => {
    const reported = async (file) =>
      (await englishOnly(file, markdown)).length > 0;
    expect(await reported("AGENTS.md")).toBe(true);
    expect(await reported(".agents/skills/case/SKILL.md")).toBe(true);
    expect(await reported(".agents/skill-patches/case.md")).toBe(true);
    expect(await reported("docs/agents/case.md")).toBe(true);
    expect(await reported("GLOSSARY.md")).toBe(false);
    expect(await reported("docs/adr/case.md")).toBe(false);
  });

  test("identifier 只能用 ASCII，声明、属性名和引用都报告", async () => {
    const [result] = await eslint.lintText(
      "const 名称 = 1;\nexport const value = { 标签: 名称, label: 名称 };\n",
      { filePath: join(project, "lib/cn.ts") },
    );
    expect(
      result.messages
        .filter(({ ruleId }) => ruleId === "id-match")
        .map(({ line, column }) => [line, column]),
    ).toStrictEqual([
      [1, 7],
      [2, 24],
      [2, 28],
      [2, 39],
    ]);
  });
});

describe("文档的链接能打开，引用 template 的代码时带 GitHub 链接", () => {
  const eslint = new ESLint({ cwd: project });
  const base = "https://github.com/fhyfhyfhy/next-template";
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const reported = async (file, source) => {
    const [result] = await eslint.lintText(source, {
      filePath: join(project, file),
    });
    expect(result.fatalErrorCount).toBe(0);
    return result.messages
      .filter(({ ruleId }) => ruleId?.startsWith("docs/"))
      .map(({ ruleId, line, column }) => [ruleId, line, column]);
  };

  test("相对链接指向不存在的文件或标题时报告，代码里的不算", async () => {
    expect(
      await reported(
        ".claude/rules/case.md",
        [
          "# Case",
          "",
          "[a](e2e.md#hydration) [b](missing.md) [c](e2e.md#no-such-heading) `[d](missing.md)`",
          "[e](#case) [f](#no-such-heading) ![g](missing.png)",
          "",
          "[h]: missing.md",
          "[i]: e2e.md#hydration",
          "",
          "```md",
          "[j](missing.md)",
          "```",
          "",
        ].join("\n"),
      ),
    ).toStrictEqual([
      ["docs/relative-links", 3, 23],
      ["docs/relative-links", 3, 39],
      ["docs/relative-links", 4, 12],
      ["docs/relative-links", 4, 34],
      ["docs/relative-links", 6, 1],
    ]);
  });

  test("GitHub 链接的文字写成另一个路径时报告，固定到某个提交的也一样", async () => {
    // 只用派生项目也保留的文件，用例在 template 和派生项目里都成立。
    expect(
      await reported(
        ".claude/rules/case.md",
        [
          `[\`lib/request/fetch.ts\`](${base}/blob/main/lib/request/fetch.ts)`,
          `[\`app/[locale]/layout.tsx\`](${base}/blob/main/app/%5Blocale%5D/layout.tsx)`,
          `[\`features/ui-catalog/\`](${base}/tree/main/features/ui-catalog)`,
          `[\`lib/db.ts\`](${base}/blob/main/lib/request/fetch.ts)`,
          `[\`lib/request/fetch.ts\`](${base}/blob/${sha}/lib/request/fetch.ts)`,
          `[\`features/ui-catalog/\`](${base}/tree/${sha}/features/ui-catalog/constants)`,
          `[the fetch wrapper](${base}/blob/main/lib/request/fetch.ts)`,
        ].join("\n\n"),
      ),
    ).toStrictEqual([
      ["docs/template-links", 7, 1],
      ["docs/template-links", 11, 1],
    ]);
  });

  test("agent 文档只用 GitHub 链接引用 Sample product 的路径", async () => {
    const source = [
      "`features/task/server/tasks.ts` and e2e/tasks.spec.ts.",
      "",
      `[\`features/upload/server.ts\`](${base}/blob/main/features/upload/server.ts)`,
      "",
      "```ts",
      'import { tasks } from "@/features/task/server";',
      "```",
      "",
    ].join("\n");
    expect(await reported(".claude/rules/case.md", source)).toStrictEqual([
      ["docs/sample-product-paths", 1, 2],
      ["docs/sample-product-paths", 1, 37],
    ]);
    expect(
      await reported(".agents/skill-patches/case.md", source),
    ).toHaveLength(2);
    expect(await reported("docs/adr/case.md", source)).toStrictEqual([]);
  });

  test("agent 文档不引用 README 和调研笔记，别的目录的 README.md 不算", async () => {
    const source =
      'read [Tests](../../README.md#tests), "Checks" in `README.md`, [sources](../../docs/research/2026-10-29-auth.md), and `plans/README.md`\n';
    const cited = async (file) =>
      (await reported(file, source))
        .filter(([rule]) => rule === "docs/people-docs")
        .map(([, , column]) => column);
    expect(await cited(".claude/rules/case.md")).toStrictEqual([20, 51, 79]);
    expect(await cited("CLAUDE.md")).toStrictEqual([20, 51, 79]);
    // 它把 README.md 列为派生项目要改写的文件。
    expect(await cited(".agents/skills/derived-project/case.md")).toStrictEqual(
      [79],
    );
    expect(await cited("docs/features.md")).toStrictEqual([]);
  });

  // 引用上游的行：3 和 4 个反引号的 diff 块里，以空格或 - 开头的行。闭合行可以比开头长，比开头短的不闭合。
  const PATCH_WITH_QUOTES = [
    "Upstream names `README.md`.",
    "",
    "```diff",
    "@@ after the `README.md` line @@",
    " Finish by updating `README.md` in the plan directory.",
    "-Read `README.md` first.",
    "+Read `README.md` last.",
    "````",
    "",
    "- Then read `README.md`.",
    "",
    "````diff",
    "```",
    "-Read `README.md` inside.",
    "````",
    "",
    "```md",
    "- Read `README.md` in a sample.",
    "```",
    "",
  ].join("\n");
  const citedLines = async (file) =>
    (await reported(file, PATCH_WITH_QUOTES))
      .filter(([rule]) => rule === "docs/people-docs")
      .map(([, line]) => line);

  test("skill patch 的 diff 块里，引用上游的上下文行和 - 行不算引用 README；+ 行、@@ 行、diff 块外和别的代码块里的算", async () => {
    expect(await citedLines(".agents/skill-patches/case.md")).toStrictEqual([
      1, 4, 7, 10, 18,
    ]);
  });

  test("只有 skill patch 的 diff 块算引用上游，别的 agent 文档照常检查", async () => {
    expect(await citedLines(".claude/rules/case.md")).toStrictEqual([
      1, 4, 5, 6, 7, 10, 14, 18,
    ]);
  });

  test("frontmatter 不是合法的 YAML 时报告，第三方 skill 也查", async () => {
    const frontmatter = (description) =>
      `---\nname: case\ndescription: ${description}\n---\n\n# Case\n`;
    const invalid = frontmatter("Projects made from x: which files they keep.");
    for (const file of [
      ".agents/skills/case/SKILL.md",
      ".agents/skills/animate/SKILL.md",
      ".claude/rules/case.md",
    ]) {
      expect(await reported(file, invalid)).toStrictEqual([
        ["docs/frontmatter", 3, 14],
      ]);
    }
    expect(
      await reported(
        ".agents/skills/case/SKILL.md",
        frontmatter('"Projects made from x: which files they keep."'),
      ),
    ).toStrictEqual([]);
  });

  test("第三方 skill 是上游原文，不检查", async () => {
    expect(
      await reported(
        ".agents/skills/animate/case.md",
        "[a](missing.md) `features/task/` README.md\n",
      ),
    ).toStrictEqual([]);
  });

  test("code-review.md 里写成行内代码的仓库路径和按名称指向的小节都要存在", async () => {
    const source = [
      "`.claude/rules/e2e.md`, `.claude/rules/missing.md`, `react-hooks/exhaustive-deps`, `messages/{locale}/`",
      '**Test data** in `.claude/rules/e2e.md`, "Hydration" and "No such section" in `e2e.md`',
      "**Setup** in `missing.md`",
      "",
      "```md",
      "`.claude/rules/missing.md`",
      "```",
      "",
    ].join("\n");
    expect(await reported("docs/agents/code-review.md", source)).toStrictEqual([
      ["docs/code-references", 1, 25],
      ["docs/code-references", 2, 42],
      ["docs/code-references", 3, 1],
    ]);
    // 别的文档里有示意用的路径，不检查。
    expect(
      (await reported("docs/agents/other.md", source)).filter(
        ([rule]) => rule === "docs/code-references",
      ),
    ).toStrictEqual([]);
  });

  test("ESLint 消息里按名称指向的小节都要存在，插值的名字跳过", async () => {
    const source = [
      `const a = 'See "Hydration" in .claude/rules/e2e.md.';`,
      'const b = `See "${section}" and "No such section" in .claude/rules/e2e.md.`;',
      `const c = 'See "Hydration" in .claude/rules/missing.md.';`,
      "",
    ].join("\n");
    expect(
      await reported("scripts/eslint/probe-plugin.mjs", source),
    ).toStrictEqual([
      ["docs/section-pointers", 2, 16],
      ["docs/section-pointers", 3, 16],
    ]);
    expect(
      await reported("scripts/eslint/probe-plugin.test.mjs", source),
    ).toStrictEqual([]);
  });
});

describe("有封装的原生元素和控件 role 只在 components/ui/ 里渲染", () => {
  const component = (jsx) => `export function Probe() {\n  return ${jsx};\n}\n`;
  for (const { name, file, source, reported } of [
    {
      name: "每种有对应组件的原生元素都被拒绝",
      file: "features/ui-catalog/components/example-list/example-card.tsx",
      source: component(`(
    <>
      <button />
      <input />
      <input type="checkbox" />
      <textarea />
      <select />
      <progress />
      <dialog />
      <form />
      <fieldset />
      <meter />
      <hr />
    </>
  )`),
      reported: Array(11).fill("native-element"),
    },
    {
      name: "render prop 里的原生元素也被拒绝",
      file: "features/ui-catalog/components/example-list/example-card.tsx",
      source: `declare function Trigger(props: { render: unknown }): null;\n${component("<Trigger render={<button />} />")}`,
      reported: ["native-element"],
    },
    {
      name: "文件选择和隐藏字段的 input 保持原生",
      file: "features/ui-catalog/components/example-list/example-card.tsx",
      source: component(`(
    <>
      <input type="file" />
      <input type={"file"} />
      <input type="hidden" />
    </>
  )`),
      reported: [],
    },
    {
      name: "同名组件和成员表达式不受影响",
      file: "features/ui-catalog/components/example-list/example-card.tsx",
      source: `declare function Form(): null;
declare const form: { Field: () => null };
${component(`(
    <>
      <Form />
      <form.Field />
    </>
  )`)}`,
      reported: [],
    },
    {
      name: "控件 role 被拒绝，其他 role 不受影响",
      file: "features/ui-catalog/components/example-list/example-card.tsx",
      source: component(`(
    <>
      <div role="button" tabIndex={0} />
      <span role="checkbox" aria-checked="false" tabIndex={0} />
      <p role="status" />
    </>
  )`),
      reported: ["control-role", "control-role"],
    },
    {
      name: "写成表达式的字符串 role 同样被拒绝",
      file: "features/ui-catalog/components/example-list/example-card.tsx",
      source: component(`(
    <>
      <div role={"button"} tabIndex={0} />
      <p role={"status"} />
    </>
  )`),
      reported: ["control-role"],
    },
    {
      name: "components/ui/ 的封装可以渲染，其他限制照旧",
      file: "components/ui/badge.tsx",
      source: `export const url = process.env.DATABASE_URL;\n${component(`(
    <>
      <button />
      <div role="button" />
    </>
  )`)}`,
      reported: ["env"],
    },
    {
      // 这个测试文件不在磁盘上：源码不 import，import/no-cycle 不用定位它。
      name: "components/ui/ 的测试文件不受应用代码的限制",
      file: "components/ui/badge.test.tsx",
      source: `export const url = process.env.DATABASE_URL;\n${component("<button />")}`,
      reported: [],
    },
    {
      name: "components/ui/ 的组件入口可以渲染，入口限制照旧",
      file: "components/ui/select/index.tsx",
      source: `${component("<select />")}export * from "./value";\n`,
      reported: ["component-entry"],
    },
    {
      name: "根目录 components/ 的组件入口照样受限",
      file: "components/locale-switcher/index.tsx",
      source: `${component("<button />")}export * from "./locale-items";\n`,
      reported: ["native-element", "component-entry"],
    },
    {
      // 只有根目录的 components/ui/ 是组件集合：feature 里的 components/ui/ 是一个组件目录，下面的 index 只是它的私有文件。
      name: "feature 里 components/ui/<目录>/index.tsx 不豁免原生元素",
      file: "features/ui-catalog/components/ui/select/index.tsx",
      source: component("<select />"),
      reported: ["native-element"],
    },
  ]) {
    test(name, async () => {
      expect(await restricted(file, source)).toStrictEqual(reported);
    });
  }

  test("原生元素、控件 role 和 UI 库的消息指向 design-system.md 的「Wrap a UI library」", async () => {
    // 小节标题是否存在由 docs/section-pointers 检查（scripts/eslint/docs-plugin.mjs）。
    const pointer =
      'See "Wrap a UI library" in .claude/rules/design-system.md.';
    const messages = (
      await messagesFor(
        "features/ui-catalog/components/example-list/example-card.tsx",
        `import { Button } from "@base-ui/react/button";

${component(`(
    <>
      <Button />
      <button type="button" />
      <div role="switch" />
    </>
  )`)}`,
        ["no-restricted-syntax", "architecture/wrapper-imports"],
      )
    ).map(({ message }) => message);
    expect(messages).toHaveLength(3);
    for (const message of messages) {
      expect(message.endsWith(pointer), message).toBe(true);
    }
  });
});

describe("触发器和控件里直接嵌套 Button 或 Link 被拒绝", () => {
  const declarations = [
    "Button",
    "Link",
    "DialogTrigger",
    "DialogClose",
    "DialogPopup",
  ]
    .map(
      (name) =>
        `declare function ${name}(props: { children?: unknown; render?: unknown; href?: string }): null;`,
    )
    .join("\n");
  const component = (jsx) =>
    `${declarations}\n\nexport function Probe() {\n  return ${jsx};\n}\n`;
  for (const { name, file, source, reported } of [
    {
      name: "触发器、关闭按钮、Button 和 Link 里直接嵌套都报告",
      file: "features/ui-catalog/components/example-list/example-card.tsx",
      source: component(`(
    <>
      <DialogTrigger>
        <Button />
      </DialogTrigger>
      <DialogClose>
        <Link href="/" />
      </DialogClose>
      <Button>
        <a href="/" />
      </Button>
      <Link href="/">
        <Button />
      </Link>
    </>
  )`),
      reported: [
        "nested-interactive",
        "nested-link",
        "nested-link",
        "nested-link",
      ],
    },
    {
      name: "原生 a 里直接嵌套 Button 或链接也报告",
      file: "features/ui-catalog/components/example-list/example-card.tsx",
      source: component(`(
    <>
      <a href="/">
        <Button />
      </a>
      <a href="/">
        <Link href="/" />
      </a>
    </>
  )`),
      reported: ["nested-link", "nested-link"],
    },
    {
      name: "里面的 Button 作为 render prop 传入、链接单独渲染都不报",
      file: "features/ui-catalog/components/example-list/example-card.tsx",
      source: component(`(
    <>
      <DialogTrigger render={<Button />} />
      <DialogClose render={<Button />} />
      <Link href="/" className="inline-flex" />
      <a href="/" />
    </>
  )`),
      reported: [],
    },
    {
      name: "原生元素和不是触发器、控件的组件里放 Button 或 Link 不报",
      file: "features/ui-catalog/components/example-list/example-card.tsx",
      source: component(`(
    <>
      <div>
        <Button />
      </div>
      <DialogPopup>
        <Button />
        <Link href="/" />
      </DialogPopup>
    </>
  )`),
      reported: [],
    },
    {
      name: "components/ui/ 里同样报告",
      file: "components/ui/badge.tsx",
      source: component(`(
    <Button>
      <button type="button" />
    </Button>
  )`),
      reported: ["nested-interactive"],
    },
    {
      name: "原生 button 里直接嵌套 Button 或链接也报告",
      file: "components/ui/badge.tsx",
      source: component(`(
    <>
      <button type="button">
        <Button />
      </button>
      <button type="button">
        <a href="/" />
      </button>
    </>
  )`),
      reported: ["nested-interactive", "nested-link"],
    },
  ]) {
    test(name, async () => {
      expect(await restricted(file, source)).toStrictEqual(reported);
    });
  }

  test("牵涉链接的消息让链接用 buttonVariants，不把它作为 render prop 传入", async () => {
    // Next 的 Link 没有 render，Base UI 的 Button 不渲染链接：消息只能指向 buttonVariants，它得真的能从这里取到并用作
    // className。这个仓库没开 import/named（eslint.config.mjs 和 eslint-config-next 都没设），.mjs 也不经 tsc 检查，
    // 导入名写错不会报错，所以直接加载模块调用它。
    const { buttonVariants } = await import("@/components/ui/button");
    expect(buttonVariants({ variant: "outline" })).toMatch(/\S/);
    const messages = (
      await messagesFor(
        "features/ui-catalog/components/example-list/example-card.tsx",
        component(`(
    <Link href="/">
      <Button />
    </Link>
  )`),
        ["no-restricted-syntax"],
      )
    ).map(({ message }) => message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain(
      "with buttonVariants from @/components/ui/button as its className",
    );
    expect(messages[0]).not.toContain("as the outer component's render prop");
  });
});

describe("给不是控件的元素加点击处理被拒绝", () => {
  test("li 和 div 的 onClick 都报告", async () => {
    const messages = await messagesFor(
      "features/ui-catalog/components/example-list/example-card.tsx",
      `export function Probe() {
  return (
    <ul>
      <li onClick={() => {}} />
      <div onClick={() => {}} />
    </ul>
  );
}
`,
      ["jsx-a11y/"],
    );
    expect(
      messages.map(({ ruleId }) => ruleId).sort(),
      JSON.stringify(messages, null, 2),
    ).toStrictEqual([
      "jsx-a11y/click-events-have-key-events",
      "jsx-a11y/click-events-have-key-events",
      "jsx-a11y/no-noninteractive-element-interactions",
      "jsx-a11y/no-static-element-interactions",
    ]);
  });
});

describe("components/ui/ 的组件和 UI catalog 的示例目录一一对应", () => {
  // 规则本身由 scripts/eslint/architecture/catalog-examples.test.mjs 验证，这里确认项目配置对两类文件都开着它。
  // 仓库里既没有 catalog-probe 组件也没有它的示例目录，两个文件各缺另一边。
  test.each([
    ["components/ui/catalog-probe.tsx", "missingExamples"],
    [
      "features/ui-catalog/components/catalog-probe-examples/index.ts",
      "missingComponent",
    ],
  ])("%s 报 %s", async (file, messageId) => {
    expect(
      (
        await messagesFor(file, "export const value = 1;\n", [
          "architecture/catalog-examples",
        ])
      ).map((message) => message.messageId),
    ).toStrictEqual([messageId]);
  });
});

describe("UI catalog 的 playground 和 example 不用相对路径引用", () => {
  // no-restricted-imports 和 no-restricted-syntax 的每条报告：这条限制记作 "relative"，RESTRICTED_IMPORTS 里请求库的
  // 记作 "global"，原生元素记作 "native-element"。
  async function restrictedImports(file, source) {
    return (
      await messagesFor(file, source, [
        "no-restricted-imports",
        "no-restricted-syntax",
      ])
    ).map(({ message }) =>
      message.includes("UI catalog")
        ? "relative"
        : message.includes("fetchApi")
          ? "global"
          : message.startsWith("Native <")
            ? "native-element"
            : message,
    );
  }
  const example =
    "features/ui-catalog/components/button-examples/basic.example.tsx";
  const playground =
    "features/ui-catalog/components/button-examples/playground.tsx";
  for (const { name, file, source, reported } of [
    {
      name: "example 里相对路径的 import、re-export 和副作用导入都报错",
      file: example,
      source: `import { value } from "./helper";
import "../styles.css";
export { other } from "./other";
export const result = value;
`,
      reported: ["relative", "relative", "relative"],
    },
    {
      name: "example 里相对路径的动态 import 和 import() 类型也报错",
      file: example,
      source: `import { lazy } from "react";

export const Heavy = lazy(() => import("./heavy"));
export type Shared = import("../shared").Shared;
`,
      reported: ["relative", "relative"],
    },
    {
      name: "example 里模板字符串写的相对路径动态 import 也报错",
      file: example,
      source: `import { lazy } from "react";

declare const name: string;

export const Heavy = lazy(() => import(\`./\${name}\`));
export const Parent = lazy(() => import(\`../heavy\`));
`,
      reported: ["relative", "relative"],
    },
    {
      name: "example 里经 @/ 或包名的动态 import 不报错",
      file: example,
      source: `import { lazy } from "react";

declare const name: string;

export const Shared = lazy(() => import("@/components/ui/button"));
export const Package = import("react");
export const ByName = import(\`@/components/\${name}\`);
`,
      reported: [],
    },
    {
      name: "example 里全局的 no-restricted-syntax 限制照旧",
      file: example,
      source: `export function Probe() {\n  return <button type="button" />;\n}\n`,
      reported: ["native-element"],
    },
    {
      name: "playground 里相对路径的 import 报错",
      file: playground,
      source: `import { value } from "../shared";\nexport const result = value;\n`,
      reported: ["relative"],
    },
    {
      name: "经 @/ 或包名引用不报错，全局的限制照旧",
      file: example,
      source: `import { IconCheck } from "@tabler/icons-react";
import axios from "axios";

import { Button } from "@/components/ui/button";

export const result = [IconCheck, axios, Button];
`,
      reported: ["global"],
    },
    {
      name: "preview 不在 catalog 里展示，可以用相对路径引用",
      file: "features/ui-catalog/components/button-examples/preview.tsx",
      source: `import { value } from "./playground";\nexport const result = value;\n`,
      reported: [],
    },
  ]) {
    test(name, async () => {
      expect(await restrictedImports(file, source)).toStrictEqual(reported);
    });
  }
});

describe("只有 lib/ 和 feature 的 server/ 访问数据库", () => {
  // import/no-cycle 关掉：它遍历磁盘上的文件，定位不了不在磁盘上的文件，用例才能用不存在的 probe 路径。
  const eslint = new ESLint({
    cwd: project,
    overrideConfig: { rules: { "import/no-cycle": "off" } },
  });
  const dataAccess = async (file, source) => {
    const [result] = await eslint.lintText(source, {
      filePath: join(project, file),
    });
    expect(result.fatalErrorCount).toBe(0);
    return result.messages
      .filter(({ ruleId }) => ruleId === "architecture/data-access")
      .map(({ message }) => message.match(/import (\S+):/)?.[1] ?? message);
  };
  const reaches = `import type { Kysely } from "kysely";
import pg from "pg";

import { getDb } from "@/lib/db";

export const probe = [getDb, pg];
export type Probe = Kysely<object>;
`;

  test.each([
    "app/api/probe/route.ts",
    "features/task/api/probe.ts",
    "features/task/components/probe.tsx",
    "features/task/server.ts",
    "features/task/components/probe.test.tsx",
    "components/probe.tsx",
    "hooks/use-probe.ts",
    "utils/probe.ts",
    "proxy.ts",
    "instrumentation.ts",
  ])("%s 引用连接模块和数据库客户端的包会报错", async (file) => {
    expect(await dataAccess(file, reaches)).toStrictEqual([
      "kysely",
      "pg",
      "lib/db",
    ]);
  });

  test.each([
    "lib/probe.ts",
    "features/task/server/probe.ts",
    "features/task/server/probe.db.test.ts",
    // 不是应用代码：e2e 直接往 e2e 的库里写测试数据，脚本负责迁移和种子数据。
    "e2e/probe.ts",
    "scripts/db/probe.mjs",
  ])("%s 可以引用", async (file) => {
    expect(await dataAccess(file, reaches)).toStrictEqual([]);
  });
});
