import assert from "node:assert/strict";
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
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const featureRule = "architecture/feature-imports";
const componentRule = "architecture/component-imports";
const componentEntryRule = "architecture/component-entry";
const componentExportsRule = "architecture/component-exports";
const wrapperRule = "architecture/wrapper-imports";
const rootRule = "architecture/root-imports";
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
addCase("根目录反向依赖仍然禁止", {
  from: "utils/CASE.ts",
  to: "lib/CASE.ts",
  source: "@/lib/CASE",
  rule: "import/no-restricted-paths",
});
addCase("feature 内部反向依赖仍然禁止", {
  from: "features/CASE/hooks/main.ts",
  to: "features/CASE/components/value.ts",
  source: "../components/value",
  rule: "import/no-restricted-paths",
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
addCase("app 内组件目录同样具有私有边界", {
  from: "app/CASE/page.tsx",
  to: "app/CASE/components/widget/private.ts",
  source: "./components/widget/private",
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
  "app/CASE/components/dialog",
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
  from: "app/CASE/components/dialog/main.ts",
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
  "app/duplicate-entry/components/dialog",
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

test("架构依赖和 feature、组件导入约定", async (t) => {
  const project = dirname(fileURLToPath(import.meta.url));
  const previousCwd = process.cwd();
  const fixture = realpathSync(
    mkdtempSync(join(tmpdir(), "next-demo-eslint-")),
  );
  try {
    copyFileSync(
      join(project, "eslint.config.mjs"),
      join(fixture, "eslint.config.mjs"),
    );
    cpSync(
      join(project, "scripts/architecture"),
      join(fixture, "scripts/architecture"),
      { recursive: true },
    );
    copyFileSync(
      join(project, "tsconfig.json"),
      join(fixture, "tsconfig.json"),
    );
    // import/no-relative-packages 要找被 lint 文件所属的 package.json，找不到会直接抛错。
    copyFileSync(join(project, "package.json"), join(fixture, "package.json"));
    // Windows 上建目录 symlink 要管理员权限或开发者模式，junction 不用；其他系统忽略这个参数。
    symlinkSync(
      join(project, "node_modules"),
      join(fixture, "node_modules"),
      "junction",
    );
    for (const { files } of cases) {
      for (const [filename, content] of Object.entries(files)) {
        const file = join(fixture, filename);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
      }
    }

    // Import resolvers also consult process.cwd(); all files must exist before graph traversal.
    process.chdir(fixture);
    // 架构用例只验证依赖边界；import 排序由下方独立用例验证。
    // fixture 会用 type 别名和类型断言构造场景，TypeScript 写法规则在这里关掉。
    const eslint = new ESLint({
      cwd: fixture,
      overrideConfig: {
        rules: {
          "simple-import-sort/imports": "off",
          "@typescript-eslint/consistent-type-definitions": "off",
          "@typescript-eslint/consistent-type-assertions": "off",
          "@typescript-eslint/no-non-null-assertion": "off",
        },
      },
    });
    for (const { name, from, rules, messageIds } of cases) {
      await t.test(name, async () => {
        const [result] = await eslint.lintFiles([join(fixture, from)]);
        assert.deepEqual(
          result.messages.map(({ ruleId }) => ruleId).sort(),
          [...rules].sort(),
          JSON.stringify(result.messages, null, 2),
        );
        if (messageIds) {
          assert.deepEqual(
            result.messages.map(({ messageId }) => messageId).sort(),
            [...messageIds].sort(),
          );
        }
      });
    }
  } finally {
    process.chdir(previousCwd);
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("import 按四组自动修复，保留客户端指令和副作用导入的相对顺序", async (t) => {
  const project = dirname(fileURLToPath(import.meta.url));
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
    await t.test(`.${extension} 应用同一套分组并支持自动修复`, async () => {
      // 应用代码目录跨目录必须用 @/，../ 分组放在不受 root-imports 约束的 scripts/ 下演示。
      const options = {
        filePath: join(project, `scripts/import-groups.${extension}`),
      };
      const [before] = await eslint.lintText(source, options);
      assert.deepEqual(
        before.messages.map(({ ruleId, severity }) => ({ ruleId, severity })),
        [{ ruleId: "simple-import-sort/imports", severity: 2 }],
      );
      const [after] = await fixer.lintText(source, options);
      assert.deepEqual(after.messages, []);
      assert.equal(after.output, expected);
      const [stable] = await fixer.lintText(expected, options);
      assert.equal(stable.output, undefined);
      assert.deepEqual(stable.messages, []);
    });
  }
});

test("TanStack Query 规则识别经 @/lib/react-query 引入的 API", async (t) => {
  const project = dirname(fileURLToPath(import.meta.url));
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
    await t.test(name, async () => {
      const [result] = await eslint.lintText(`${header}\n${body}\n`, {
        filePath,
      });
      assert.equal(result.fatalErrorCount, 0);
      // 各示例共用 header 的 import，未使用的 import 不在这组用例的检查范围内。
      assert.deepEqual(
        result.messages
          .map(({ ruleId }) => ruleId)
          .filter((ruleId) => ruleId?.startsWith("@tanstack/query/"))
          .sort(),
        rules,
        JSON.stringify(result.messages, null, 2),
      );
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
    await t.test(name, async () => {
      const [result] = await eslint.lintText(
        `import { mutationOptions, useMutation } from "@/lib/react-query";\n\n${body}\n`,
        { filePath },
      );
      assert.deepEqual(
        result.messages
          .filter(({ ruleId }) => ruleId === "data-fetching/mutation-callbacks")
          .map(({ message }) => message.match(/^Keep (\w+)/)?.[1]),
        reported,
        JSON.stringify(result.messages, null, 2),
      );
    });
  }
  for (const source of ["axios", "swr", "swr/mutation"]) {
    await t.test(`禁止引入 ${source}`, async () => {
      const [result] = await eslint.lintText(
        `import value from "${source}";\n\nexport const result = value;\n`,
        { filePath },
      );
      assert.deepEqual(
        result.messages.map(({ ruleId }) => ruleId),
        ["no-restricted-imports"],
      );
    });
  }
});
