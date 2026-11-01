import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
const packageImportsRule = "architecture/package-imports";
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
    `/* eslint-disable @typescript-eslint/no-require-imports -- the case checks a dependency written with require */\nexport const result = require("${source}");`,
  importEquals: (source) =>
    `/* eslint-disable @typescript-eslint/no-require-imports -- the case checks a dependency written with require */\nimport result = require("${source}"); export { result };`,
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

addCase("an alias import within the same feature is refused", {
  to: "features/CASE/hooks/value.ts",
  source: "@/features/CASE/hooks/value",
  rule: featureRule,
});
addCase(
  "an implementation file cannot import its own feature's root entry through the alias",
  {
    to: "features/CASE/index.ts",
    source: "@/features/CASE",
    rule: featureRule,
    messageId: "selfEntry",
  },
);
addCase(".. in an alias cannot bypass the same-feature check", {
  to: "features/CASE/hooks/value.ts",
  source: "@/features/CASE/../CASE/hooks/value",
  rule: featureRule,
});
addCase("a feature can import its own lower layer by relative path", {
  to: "features/CASE/hooks/value.ts",
  source: "../hooks/value",
});
addCase("a feature can import its own same layer by relative path", {
  from: "features/CASE/hooks/main.ts",
  to: "features/CASE/hooks/value.ts",
  source: "./value",
});
addCase("another feature cannot be imported by relative path", {
  to: "features/CASE-other/index.ts",
  source: "../../CASE-other",
  rule: featureRule,
});
addCase("a feature must import root lib through the alias", {
  to: "lib/CASE.ts",
  source: "../../../lib/CASE",
  rule: featureRule,
});
addCase("app must import a feature through the alias", {
  from: "app/CASE.ts",
  to: "features/CASE/index.ts",
  source: "../features/CASE",
  rule: featureRule,
});
addCase("a feature can import root lib through the alias", {
  to: "lib/CASE.ts",
  source: "@/lib/CASE",
});
addCase("a feature can import another feature's main entry through the alias", {
  to: "features/CASE-other/index.ts",
  source: "@/features/CASE-other",
});
addCase("a feature can import another feature's sub-entry through the alias", {
  to: "features/CASE-other/canvas.ts",
  source: "@/features/CASE-other/canvas",
});
addCase("third-party package names are not limited by the feature path rules", {
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
  addCase(`${syntax} refuses a same-feature alias`, {
    to: "features/CASE/hooks/value.ts",
    source: "@/features/CASE/hooks/value",
    syntax,
    rule: featureRule,
  });
  addCase(`${syntax} allows a same-feature relative path`, {
    to: "features/CASE/hooks/value.ts",
    source: "../hooks/value",
    syntax,
  });
  addCase(`${syntax} refuses a cross-feature relative path`, {
    to: "features/CASE-other/index.ts",
    source: "../../CASE-other",
    syntax,
    rule: featureRule,
  });
}

for (const syntax of ["import", "dynamic"]) {
  addCase(`${syntax} cannot reach another feature's private file`, {
    to: "features/CASE-other/hooks/private.ts",
    source: "@/features/CASE-other/hooks/private",
    syntax,
    rule: featureRule,
  });
  addCase(
    `${syntax} cannot use an internal directory's barrel as a public sub-entry`,
    {
      to: "features/CASE-other/hooks/index.ts",
      source: "@/features/CASE-other/hooks",
      syntax,
      rule: featureRule,
    },
  );
}

cases.push({
  name: "a root sub-entry file takes precedence over an internal directory of the same name",
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

addCase("a root dependency on the same layer is allowed", {
  from: "lib/CASE-main.ts",
  to: "lib/CASE-value.ts",
  source: "./CASE-value",
});
addCase("a root dependency on a lower layer is allowed", {
  from: "hooks/CASE.ts",
  to: "lib/CASE.ts",
  source: "@/lib/CASE",
});
addCase("components/ui can depend on the lower hooks layer", {
  from: "components/ui/CASE.ts",
  to: "hooks/CASE.ts",
  source: "@/hooks/CASE",
});
addCase("an upward dependency between root layers is still forbidden", {
  from: "utils/CASE.ts",
  to: "lib/CASE.ts",
  source: "@/lib/CASE",
  rule: "import/no-restricted-paths",
});
addCase("e2e cannot import app code by relative path", {
  from: "e2e/CASE.spec.ts",
  to: "lib/CASE.ts",
  source: "../lib/CASE",
  rule: "import/no-restricted-paths",
});
addCase("e2e cannot import a feature entry through the alias", {
  from: "e2e/CASE.spec.ts",
  to: "features/CASE/index.ts",
  source: "@/features/CASE",
  rule: "import/no-restricted-paths",
});
addCase("e2e can import its own helper modules by relative path", {
  from: "e2e/CASE.spec.ts",
  to: "e2e/CASE-helper.ts",
  source: "./CASE-helper",
});
addCase("an upward dependency within a feature is still forbidden", {
  from: "features/CASE/hooks/main.ts",
  to: "features/CASE/components/value.ts",
  source: "../components/value",
  rule: "import/no-restricted-paths",
});
cases.push({
  name: "a value import cycle between files of the same layer is still forbidden",
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
    name: `${syntax} refuses a feature cycle even when the file graph has none`,
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

addCase(
  "a private file of a root component directory cannot be reached directly through the alias",
  {
    from: "app/CASE.ts",
    to: "components/CASE/private.ts",
    source: "@/components/CASE/private",
    rule: componentRule,
  },
);
addCase("a relative path cannot bypass a component's private boundary", {
  from: "features/CASE/components/other/index.ts",
  to: "features/CASE/components/panel/private.ts",
  source: "../panel/private",
  rule: componentRule,
});
addCase("a dynamic import cannot reach a UI component's private file", {
  from: "app/CASE.ts",
  to: "components/ui/CASE/private.ts",
  source: "@/components/ui/CASE/private",
  syntax: "dynamic",
  rule: componentRule,
});
addCase("a re-export cannot reach a component's private file", {
  from: "app/CASE.ts",
  to: "components/CASE/private.ts",
  source: "@/components/CASE/private",
  syntax: "reexport",
  rule: componentRule,
});
for (const syntax of ["importType", "tsImportType"]) {
  addCase(
    `${syntax} cannot reach a private type of another component in the same feature`,
    {
      from: "features/CASE/components/consumer/main.ts",
      to: "features/CASE/components/widget/private.ts",
      source: "../widget/private",
      syntax,
      rule: componentRule,
    },
  );
}
addCase(
  "a feature root entry cannot re-export a component's private file directly",
  {
    from: "features/CASE/index.ts",
    to: "features/CASE/components/widget/private.ts",
    source: "./components/widget/private",
    syntax: "reexport",
    rule: componentRule,
  },
);
addCase("component directories in app have private boundaries too", {
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
  addCase(`${directory} can import its own private files by relative path`, {
    from: `${directory}/main.ts`,
    to: `${directory}/internal/value.ts`,
    source: "./internal/value",
  });
}
addCase("a component directory's implicit index.ts is its public entry", {
  from: "app/CASE.ts",
  to: "components/CASE/index.ts",
  source: "@/components/CASE",
});
addCase("a component directory's explicit index.tsx is its public entry", {
  from: "app/CASE.ts",
  to: "components/CASE/index.tsx",
  source: "@/components/CASE/index.tsx",
});
addCase("a UI component directory's implicit index.tsx is its public entry", {
  from: "app/CASE.ts",
  to: "components/ui/CASE/index.tsx",
  source: "@/components/ui/CASE",
});
addCase(
  "a feature root entry can re-export a compound component's public entry",
  {
    from: "features/CASE/index.ts",
    to: "features/CASE/components/widget/index.tsx",
    source: "./components/widget",
    syntax: "reexport",
  },
);
addCase("a single-file component is not mistaken for a private file", {
  from: "app/CASE.ts",
  to: "components/CASE.tsx",
  source: "@/components/CASE",
});

for (const extension of ["ts", "tsx"]) {
  const component = `components/compound-${extension}`;
  cases.push({
    name: `compound component index.${extension} allows several named exports and type exports`,
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
      name: `compound component index.${extension} forbids ${syntax} re-exports`,
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
  addCase(
    `${syntax} cannot import its own feature's main entry from an implementation file`,
    {
      from: "features/CASE/utils/main.ts",
      to: "features/CASE/index.ts",
      source: "../index",
      syntax,
      rule: featureRule,
      messageId: "selfEntry",
    },
  );
  addCase(
    `${syntax} cannot import its own feature's sub-entry from an implementation file`,
    {
      from: "features/CASE/utils/main.ts",
      to: "features/CASE/canvas.ts",
      source: "../canvas",
      syntax,
      rule: featureRule,
      messageId: "selfEntry",
    },
  );
}
cases.push({
  name: "a feature's own entry cannot be used to bypass the layer rules indirectly",
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
addCase(
  "a feature root entry can aggregate its own sub-entries by relative path",
  {
    from: "features/CASE/index.ts",
    to: "features/CASE/canvas.ts",
    source: "./canvas",
    syntax: "reexport",
  },
);
addCase(
  "an alias to the feature's own sub-entry reports only the self-entry import",
  {
    from: "features/CASE/utils/main.ts",
    to: "features/CASE/canvas.ts",
    source: "@/features/CASE/canvas",
    rule: featureRule,
    messageId: "selfEntry",
  },
);
addCase(
  "within a feature, another component of the same layer is still reached through its entry",
  {
    from: "features/CASE/components/consumer.ts",
    to: "features/CASE/components/dialog/index.ts",
    source: "./dialog",
  },
);

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
      ? `/* eslint-disable @typescript-eslint/no-require-imports -- the case checks a dependency written with require */\nmodule.exports = require("${source}");`
      : statements.import(source);
  const value = commonjs
    ? "module.exports = { value: 1 };"
    : "export const value = 1;";
  const component = `components/extension-${extension}.${extension}`;
  const feature = `features/extension-${extension}/index.ts`;
  cases.push({
    name: `.${extension} component directly under components/ cannot depend upward on a feature`,
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
    name: `.${extension} lib cannot depend upward on a component directly under components/`,
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
    name: `.${extension} component directly under components/ can depend on the lower lib layer, and the config loads`,
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
    name: `.${extension} component entry named explicitly is open to outside code`,
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
    name: `.${extension} component's private implementation cannot be imported directly from outside`,
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
      name: `.${extension} component entry forbids star re-exports`,
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
      name: `.${extension} module cycle within one layer is refused`,
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
  addCase(
    `${syntax} cannot use the conditional credentials entry outside fetchApi`,
    {
      from: "lib/CASE.ts",
      source: "#credentials",
      syntax,
      rule: packageImportsRule,
      messageId: "owner",
    },
  );
  addCase(
    `${syntax} cannot bypass the architecture checks through an unsupported package import`,
    {
      from: "app/CASE.ts",
      source: "#other",
      syntax,
      rule: packageImportsRule,
      messageId: "unsupported",
    },
  );
  addCase(
    `${syntax} forbids app code from importing the React Query package directly`,
    {
      from: "app/CASE.ts",
      source: "@tanstack/react-query",
      syntax,
      rule: wrapperRule,
    },
  );
  addCase(
    `${syntax} allows importing through the public React Query wrapper entry`,
    {
      from: "app/CASE.ts",
      source: "@/lib/react-query",
      syntax,
    },
  );
}
addCase(
  "fetchApi can choose its credentials implementation through the conditional entry",
  {
    from: "lib/fetch/index.ts",
    to: "lib/fetch/credentials-browser.ts",
    source: "#credentials",
  },
);
addCase(
  "the index of another lib directory cannot use the conditional credentials entry",
  {
    from: "lib/CASE/index.ts",
    source: "#credentials",
    rule: packageImportsRule,
    messageId: "owner",
  },
);
addCase(
  "a file in the fetch directory other than index cannot use the conditional credentials entry",
  {
    from: "lib/fetch/CASE.ts",
    source: "#credentials",
    rule: packageImportsRule,
    messageId: "owner",
  },
);
addCase("index.tsx cannot use the conditional credentials entry", {
  from: "lib/fetch/index.tsx",
  source: "#credentials",
  rule: packageImportsRule,
  messageId: "owner",
});
addCase(
  "subpaths of the React Query package too can be imported only by the wrapper",
  {
    from: "app/CASE.ts",
    source: "@tanstack/react-query/build/modern/index.js",
    rule: wrapperRule,
  },
);
addCase("a similar package name is not mistaken for the React Query package", {
  from: "app/CASE.ts",
  source: "@tanstack/react-query-devtools",
});
addCase("other lib files do not get the React Query package exemption", {
  from: "lib/CASE.ts",
  source: "@tanstack/react-query",
  rule: wrapperRule,
});
addCase(
  "a file whose name starts with the wrapper's does not get the exemption",
  {
    from: "lib/react-query.CASE.ts",
    source: "@tanstack/react-query",
    rule: wrapperRule,
  },
);
addCase(
  "a file of the wrapper's name in a lib subdirectory does not get its exemption",
  {
    from: "lib/CASE/react-query.ts",
    source: "@tanstack/react-query",
    rule: wrapperRule,
  },
);

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
    name: `the react-query.${extension} wrapper can import the package`,
    from: file,
    files: {
      [file]:
        extension === "cjs"
          ? '/* eslint-disable @typescript-eslint/no-require-imports -- the case checks a dependency written with require */\nmodule.exports = require("@tanstack/react-query");'
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
  addCase(
    `a component can import its private ${privateFile} by relative path`,
    {
      from: "components/ui/CASE/root.ts",
      to: `components/ui/CASE/${privateFile}`,
      source: `./${privateFile}`,
    },
  );
  for (const syntax of [
    "import",
    "dynamicTemplate",
    "reexport",
    "tsImportType",
    "require",
    "importEquals",
  ]) {
    addCase(
      `${syntax} forbids code outside the component from reaching its private ${privateFile}`,
      {
        from: "app/CASE.ts",
        to: `components/ui/CASE/${privateFile}`,
        source: `@/components/ui/CASE/${privateFile}`,
        syntax,
        rule: componentRule,
      },
    );
  }
}
cases.push({
  name: "a compound component can share a private Context and export each part explicitly through its entry",
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
    addCase(
      `${syntax} through the alias inside ${directory} reports the path error only once`,
      {
        from: `${directory}/main.ts`,
        to: `${directory}/private.ts`,
        source: `@/${directory}/private`,
        syntax,
        rule: feature ? featureRule : componentRule,
        messageId: "relative",
      },
    );
  }
  addCase(`a relative path inside ${directory} is still allowed`, {
    from: `${directory}/main.ts`,
    to: `${directory}/private.ts`,
    source: "./private",
  });
}
addCase(
  "a shared component can import another component's entry through the alias",
  {
    from: "components/CASE-consumer/main.ts",
    to: "components/CASE-provider/index.ts",
    source: "@/components/CASE-provider",
  },
);
addCase(
  "a UI component can import another UI component's entry through the alias",
  {
    from: "components/ui/CASE-consumer/main.ts",
    to: "components/ui/CASE-provider/index.ts",
    source: "@/components/ui/CASE-provider",
  },
);
addCase(
  "a component local to app can import a shared component's entry through the alias",
  {
    from: "app/CASE/components/dialog/main.ts",
    to: "components/CASE/index.ts",
    source: "@/components/CASE",
  },
);

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
    name: `index.${extension} beside another source entry is reported even when linting that one file`,
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
    name: `${directory} with both index.ts and index.tsx is refused`,
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
      name: `${extension}: a declaration entry beside the implementation entry is not flagged`,
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
    name: `${directory}: a collection or feature root is not checked for a single entry as a component directory is`,
    from: `${directory}/index.ts`,
    files: {
      [`${directory}/index.ts`]: "export const value = 1;",
      [`${directory}/index.tsx`]: "export const otherValue = 2;",
    },
    rules: [],
  });
}

const namespaceExports = [
  ["exporting the namespace by name", "export { Parts };", true],
  [
    "exporting the namespace under another name",
    "export { Parts as Dialog };",
    true,
  ],
  ["exporting the namespace as default", "export default Parts;", true],
  [
    "exporting the namespace by name as default",
    "export { Parts as default };",
    true,
  ],
  [
    "exporting a variable initialized to the namespace",
    "export const Dialog = Parts;",
    true,
  ],
  [
    "exporting the namespace through a const alias",
    "const Dialog = Parts; export { Dialog };",
    true,
  ],
  [
    "exporting the namespace as default through several const aliases",
    "const First = Parts; const Dialog = First; export default Dialog;",
    true,
  ],
  [
    "initializing a public variable from a const alias",
    "const Alias = Parts; export const Dialog = Alias;",
    true,
  ],
  [
    "a type assertion does not hide a namespace export",
    "export const Dialog = Parts as typeof Parts;",
    true,
  ],
  [
    "satisfies does not hide a namespace export",
    "export const Dialog = Parts satisfies typeof Parts;",
    true,
  ],
  [
    "an object spread cannot expose the whole namespace",
    "export const Dialog = { ...Parts };",
    true,
  ],
  [
    "an object property cannot carry the whole namespace",
    "export const Dialog = { Parts };",
    true,
  ],
  [
    "a nested object cannot carry the whole namespace",
    "export const Dialog = { nested: { Parts } };",
    true,
  ],
  [
    "an array cannot carry the whole namespace",
    "export const Dialog = [Parts];",
    true,
  ],
  [
    "a const alias of an object cannot hide the namespace",
    "const Alias = { ...Parts }; export const Dialog = Alias;",
    true,
  ],
  [
    "an alias declared after its export cannot expose the namespace either",
    "export { Dialog }; const Dialog = Parts;",
    true,
  ],
  [
    "object rest properties cannot expose the whole namespace",
    "const { ...Dialog } = Parts; export { Dialog };",
    true,
  ],
  [
    "the namespace's rest properties cannot be exported even with some members taken out",
    "const { Root, ...Dialog } = Parts; export { Root, Dialog };",
    true,
  ],
  [
    "an exported destructured variable cannot expose the namespace's rest properties",
    "export const { ...Dialog } = Parts;",
    true,
  ],
  [
    "selecting one member of the namespace",
    "export const Root = Parts.Root;",
    false,
  ],
  [
    "selecting several namespace members explicitly into a compound component",
    "export const Dialog = { Root: Parts.Root, Trigger: Parts.Trigger };",
    false,
  ],
  [
    "an internal namespace alias used only to select members",
    "const Alias = Parts; export const Root = Alias.Root;",
    false,
  ],
  [
    "selecting namespace members by destructuring",
    "const { Root, Trigger } = Parts; export { Root, Trigger };",
    false,
  ],
  [
    "the rest properties of an object of explicit members can be exported",
    "const Explicit = { Root: Parts.Root }; const { ...Dialog } = Explicit; export { Dialog };",
    false,
  ],
  [
    "a local variable named like the namespace is not mistaken for it",
    "export const Root = Parts.Root; function createDialog() { const Parts = { open: false }; return Parts; } export const Dialog = createDialog();",
    false,
  ],
];
for (const [name, statement, rejected] of namespaceExports) {
  const directory = `components/namespace-export-${cases.length}`;
  cases.push({
    name: `component entry: ${name}`,
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
  ["export = cannot expose the whole namespace", "export = Parts;", true],
  [
    "export = can export a namespace member explicitly",
    "export = Parts.Root;",
    false,
  ],
]) {
  const directory = `components/export-assignment-${cases.length}`;
  cases.push({
    name: `.cts component entry: ${name}`,
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
  name: "a component entry cannot export a whole type namespace",
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
  name: "a component entry may still use the React namespace internally and select its members",
  from: "components/react-namespace-internal/index.tsx",
  files: {
    "components/react-namespace-internal/index.tsx":
      'import * as React from "react"; export type Props = { children: React.ReactNode }; export const Root = React.Fragment;',
  },
  rules: [],
});
cases.push({
  name: "a component entry can export components and type aliases imported by name",
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
  name: "a namespace export in a component's implementation file is not flagged by the entry rule",
  from: "components/private-namespace-export/internal.ts",
  files: {
    "components/private-namespace-export/parts.ts": "export const Root = 1;",
    "components/private-namespace-export/internal.ts":
      'import * as Parts from "./parts"; export { Parts };',
  },
  rules: [],
});
cases.push({
  name: "a feature root entry is not flagged by the component namespace export rule",
  from: "features/feature-namespace-export/index.ts",
  files: {
    "features/feature-namespace-export/utils/parts.ts":
      "export const value = 1;",
    "features/feature-namespace-export/index.ts":
      'import * as Parts from "./utils/parts"; export { Parts };',
  },
  rules: [],
});

addCase("root code importing across directories by relative path is refused", {
  from: "lib/CASE.ts",
  to: "utils/CASE.ts",
  source: "../utils/CASE",
  rule: rootRule,
  messageId: "alias",
});
addCase("root code importing within its directory through @/ is refused", {
  from: "utils/CASE-a.ts",
  to: "utils/CASE-b.ts",
  source: "@/utils/CASE-b",
  rule: rootRule,
  messageId: "relative",
});
addCase("app importing its subdirectory through @/ is refused", {
  from: "app/CASE/page.tsx",
  to: "app/CASE/parts/value.ts",
  source: "@/app/CASE/parts/value",
  rule: rootRule,
  messageId: "relative",
});
addCase("root code importing across directories through @/ is allowed", {
  from: "lib/CASE.ts",
  to: "utils/CASE.ts",
  source: "@/utils/CASE",
});
addCase("app importing its subdirectory by relative path is allowed", {
  from: "app/CASE/page.tsx",
  to: "app/CASE/parts/value.ts",
  source: "./parts/value",
});
addCase("scripts/ can import across directories by relative path", {
  from: "scripts/CASE/main.mjs",
  to: "scripts/other-CASE/value.mjs",
  source: "../other-CASE/value.mjs",
});
addCase("importing an npm package by relative path is refused", {
  from: "lib/CASE.ts",
  source: "../node_modules/react",
  rule: "import/no-relative-packages",
});

for (const [name, from, rules] of [
  ["a camelCase file name is refused", "utils/formatBytes.ts", [namingRule]],
  [
    "a PascalCase directory name is refused",
    "features/TaskBoard/utils/value.ts",
    [namingRule],
  ],
  [
    "dotted file names and directories starting with a dot are allowed",
    ".config/naming.example.ts",
    [],
  ],
  [
    "route groups, parallel routes, intercepting routes and dynamic segments are allowed under app/",
    "app/(shop)/@modal/(..)items/[itemId]/page.tsx",
    [],
  ],
  [
    "private folders and catch-all segments are allowed under app/",
    "app/_internal/[...catchAll]/[[...rest]]/page.tsx",
    [],
  ],
  [
    "Next.js route syntax is allowed only under app/",
    "components/_private/value.ts",
    [namingRule],
  ],
  [
    "file names under app/ must still be kebab-case",
    "app/[id]/PageContent.tsx",
    [namingRule],
  ],
  [
    "a snake_case dynamic segment name is refused",
    "app/[task_id]/page.tsx",
    [namingRule],
  ],
]) {
  cases.push({
    name: `file naming: ${name}`,
    from,
    files: { [from]: "export const value = 1;" },
    rules,
  });
}

for (const [name, from, directive, rules] of [
  [
    "eslint-disable without a reason is refused",
    "utils/disable-without-reason.ts",
    "// eslint-disable-next-line @typescript-eslint/no-explicit-any",
    ["@eslint-community/eslint-comments/require-description"],
  ],
  [
    "eslint-disable with a reason after -- is allowed",
    "utils/disable-with-reason.ts",
    "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the third-party callback's parameter is untyped",
    [],
  ],
]) {
  cases.push({
    name: `disable comments: ${name}`,
    from,
    files: { [from]: `${directive}\nexport const value: any = 1;` },
    rules,
  });
}

describe("architecture dependencies and the feature and component import conventions", () => {
  let previousCwd;
  let fixture;
  let eslint;

  beforeAll(() => {
    previousCwd = process.cwd();
    fixture = realpathSync(mkdtempSync(join(tmpdir(), "next-demo-eslint-")));
    copyFileSync(
      join(project, "eslint.config.mjs"),
      join(fixture, "eslint.config.mjs"),
    );
    cpSync(join(project, "scripts/eslint"), join(fixture, "scripts/eslint"), {
      recursive: true,
    });
    // eslint.config.mjs takes the ignores for the build directories from here.
    copyFileSync(
      join(project, "scripts/build-dirs.mjs"),
      join(fixture, "scripts/build-dirs.mjs"),
    );
    copyFileSync(
      join(project, "tsconfig.json"),
      join(fixture, "tsconfig.json"),
    );
    // import/no-relative-packages looks for the package.json the linted file belongs to, and
    // throws when there is none.
    copyFileSync(join(project, "package.json"), join(fixture, "package.json"));
    // On Windows a directory symlink needs admin rights or Developer Mode and a junction does not;
    // other systems ignore this argument.
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
    // The architecture cases check only dependency boundaries; import order has its own tests below.
    // The fixtures build their cases with type aliases and type assertions, so the TypeScript style
    // rules are off here.
    eslint = new ESLint({
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
  });

  afterAll(() => {
    process.chdir(previousCwd);
    rmSync(fixture, { recursive: true, force: true });
  });

  for (const { name, from, rules, messageIds } of cases) {
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
    });
  }

  describe("the conditional credentials entry accepts only the supported mapping", () => {
    // The fixture's package.json is a copy of the project's, and the mapping cases must be known
    // when tests are collected, so they read the project's directly.
    const manifest = JSON.parse(
      readFileSync(join(project, "package.json"), "utf8"),
    );
    const credentialImports = manifest.imports["#credentials"];
    const manifestPath = () => join(fixture, "package.json");
    const filePath = () => join(fixture, "lib/fetch/index.ts");
    let originalManifest;
    const restoreManifest = () =>
      writeFileSync(manifestPath(), originalManifest, "utf8");

    beforeAll(() => {
      originalManifest = readFileSync(manifestPath(), "utf8");
    });
    afterAll(restoreManifest);

    for (const [name, mapping] of [
      ["a missing mapping", undefined],
      [
        "a direct mapping loses the split between environments",
        credentialImports.default,
      ],
      [
        "the server branch cannot point to another layer",
        {
          ...credentialImports,
          "react-server": "./features/account/api/credentials.ts",
        },
      ],
      [
        "the default branch cannot be another lib file",
        { ...credentialImports, default: "./lib/fetch/index.ts" },
      ],
      [
        "default cannot come before the server branch",
        {
          default: credentialImports.default,
          "react-server": credentialImports["react-server"],
        },
      ],
      [
        "an extra condition cannot bypass the target restriction",
        {
          browser: "./features/account/api/credentials.ts",
          ...credentialImports,
        },
      ],
    ]) {
      test(name, async () => {
        writeFileSync(
          manifestPath(),
          JSON.stringify({
            ...manifest,
            imports: { ...manifest.imports, "#credentials": mapping },
          }),
          "utf8",
        );
        const [result] = await eslint.lintText(
          statements.import("#credentials"),
          { filePath: filePath() },
        );
        expect(result.fatalErrorCount).toBe(0);
        expect(
          result.messages
            .filter(({ ruleId }) => ruleId === packageImportsRule)
            .map(({ messageId }) => messageId),
          JSON.stringify(result.messages, null, 2),
        ).toStrictEqual(["mapping"]);
      });
    }

    test("with the supported mapping restored nothing is reported, and other # entries are still refused", async () => {
      restoreManifest();
      const [restored] = await eslint.lintText(
        statements.import("#credentials"),
        { filePath: filePath() },
      );
      expect(restored.messages).toStrictEqual([]);
      const [unsupported] = await eslint.lintText(statements.import("#other"), {
        filePath: filePath(),
      });
      expect(
        unsupported.messages.map(({ ruleId, messageId }) => ({
          ruleId,
          messageId,
        })),
      ).toStrictEqual([
        { ruleId: packageImportsRule, messageId: "unsupported" },
      ]);
    });
  });
});

describe("imports are fixed into four groups, keeping the client directive and the relative order of side-effect imports", () => {
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
    test(`.${extension} gets the same groups and the autofix`, async () => {
      // App code must import across directories through @/, so the ../ group is shown under scripts/,
      // which root-imports does not constrain.
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

describe("the data access rules cover the React Query wrapper, mutation callbacks and request libraries", () => {
  // import/no-cycle needs the linted file to exist when it walks the dependency graph; lintText's
  // virtual file crashes it.
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
      name: "an inline queryKey and queryFn must use queryOptions instead",
      body: `export function Example() {
  return useQuery({ queryKey: ["a"], queryFn: () => 1 }).data;
}`,
      rules: ["@tanstack/query/prefer-query-options"],
    },
    {
      name: "rest destructuring of a query result subscribes to every field",
      body: `export function Example() {
  const { data, ...rest } = useQuery(options);
  return [data, rest];
}`,
      rules: ["@tanstack/query/no-rest-destructuring"],
    },
    {
      name: "a mutation result object cannot be a dependency",
      body: `export function Example() {
  const mutation = useMutation({ mutationFn: () => Promise.resolve(1) });
  return useCallback(() => mutation.mutate(), [mutation]);
}`,
      rules: ["@tanstack/query/no-unstable-deps"],
    },
    {
      name: "a client component creates a QueryClient on every render",
      body: `export function Example() {
  const client = new QueryClient();
  return client;
}`,
      rules: ["@tanstack/query/stable-query-client"],
    },
    {
      name: "an async Server Component can create a QueryClient per render",
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
      // The examples share the header's imports; unused imports are outside what these cases check.
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
      name: "callbacks in useMutation replace the factory's callbacks",
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
      name: "callbacks in the mutationOptions factory and in mutate are not reported",
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
          .filter(({ ruleId }) => ruleId === "data-fetching/mutation-callbacks")
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
      name: "queryOptions in an update- file belongs in a get- file",
      file: "features/example/api/update-task-favorite.ts",
      body: "export const favorites = queryOptions({ queryKey: ['a'], queryFn: () => 1 });",
      reported: ["queryOptions"],
    },
    {
      name: "infiniteQueryOptions in a create- file belongs in a get- file",
      file: "features/example/api/create-task.ts",
      body: "export const feed = infiniteQueryOptions({ queryKey: ['a'], queryFn: () => 1, initialPageParam: 1, getNextPageParam: () => 2 });",
      reported: ["infiniteQueryOptions"],
    },
    {
      name: "queryOptions imported under another name in a delete- file belongs in a get- file too",
      file: "features/example/api/delete-task.ts",
      imports: "queryOptions as listOptions",
      body: "export const list = listOptions({ queryKey: ['a'], queryFn: () => 1 });",
      reported: ["queryOptions"],
    },
    {
      name: "mutationOptions in a get- file belongs in the file of the write request",
      file: "features/example/api/get-tasks.ts",
      body: "export const save = mutationOptions({ mutationFn: () => Promise.resolve(1) });",
      reported: ["mutationOptions"],
    },
    {
      name: "a query factory in a get- file is not reported",
      file: "features/example/api/get-tasks.ts",
      body: "export const list = queryOptions({ queryKey: ['a'], queryFn: () => 1 });",
      reported: [],
    },
    {
      name: "mutationOptions in an update- file is not reported",
      file: "features/example/api/update-task.ts",
      body: "export const save = mutationOptions({ mutationFn: () => Promise.resolve(1) });",
      reported: [],
    },
    {
      name: "a file named with a domain verb maps to no fixed HTTP method, so it is not checked",
      file: "features/example/api/search-tasks.ts",
      body: "export const search = queryOptions({ queryKey: ['a'], queryFn: () => 1 });",
      reported: [],
    },
    {
      name: "files outside api/ are not checked",
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
          .filter(({ ruleId }) => ruleId === "data-fetching/api-file-factories")
          .map(({ message }) => message.split(" ")[0]),
        JSON.stringify(result.messages, null, 2),
      ).toStrictEqual(reported);
    });
  }
  for (const source of ["axios", "swr", "swr/mutation"]) {
    test(`importing ${source} is forbidden`, async () => {
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

describe("Tailwind classes are checked for canonical form, colors and radii against the project's theme", () => {
  const eslint = new ESLint({ cwd: project });
  const filePath = join(project, "components/tailwind-classes.tsx");

  test("fixes classes to their canonical form by the project's theme and the 16px root font size", async () => {
    // h-control-sm is defined only in app/globals.css, so it confirms the plugin read the project's theme.
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

  test("colors may only be semantic tokens, black and white, and radii only built-in or project tokens", async () => {
    const restricted = [
      "bg-red-500",
      "hover:text-zinc-400/50",
      // A palette new in Tailwind 4.2, which confirms the palette names are read from tailwindcss.
      "border-t-mauve-200",
      "bg-[#c83d21]",
      "shadow-[0_0_0_1px_#000_inset]",
      "shadow-[0_2px_4px_rgb(0_0_0/0.2)]",
      "rounded-[5px]",
      "md:rounded-tl-(--my-radius)",
    ];
    const allowed = [
      "bg-primary text-primary-foreground border-border",
      "bg-white text-black/65",
      "rounded rounded-sm rounded-2xl rounded-full",
      "rounded-control rounded-t-panel",
      "text-sm border-2 ring-2 bg-transparent fill-current",
    ];
    const classes = [...restricted, ...allowed];
    const source = `export const panels = [\n${classes
      .map((className) => `  <div className="${className}" />,`)
      .join("\n")}\n];\n`;
    const [result] = await eslint.lintText(source, { filePath });
    expect(
      result.messages
        .filter(
          ({ ruleId }) => ruleId === "better-tailwindcss/no-restricted-classes",
        )
        .map(({ line }) => classes[line - 2]),
      JSON.stringify(result.messages, null, 2),
    ).toStrictEqual(restricted);
  });
});

describe("e2e confirms the page has hydrated after a full page load before acting on it", () => {
  const eslint = new ESLint({ cwd: project });
  const filePath = join(project, "e2e/act-after-ready.spec.ts");
  const lint = async (body) => {
    const source = `import { expect, type Page, test } from "@playwright/test";\n\ndeclare function openTask(page: Page): Promise<void>;\n\ntest("case", async ({ page }) => {\n${body}\n});\n`;
    const [result] = await eslint.lintText(source, { filePath });
    return (
      result.messages
        .filter(({ ruleId }) => ruleId === "e2e/act-after-ready")
        // The body starts on line 6 of the source; convert to line numbers within the body.
        .map(({ line }) => line - 5)
    );
  };

  test("acting right after goto or reload is refused", async () => {
    expect(
      await lint(
        `  await page.goto("/a");\n  const button = page.getByRole("button");\n  await button.click();`,
      ),
    ).toStrictEqual([3]);
    expect(
      await lint(
        `  await page.reload();\n  await page.getByLabel("Name").fill("x");`,
      ),
    ).toStrictEqual([2]);
  });

  test("acting after an expect or a helper confirms the page is allowed", async () => {
    expect(
      await lint(
        `  await page.goto("/a");\n  await expect(page.getByText("Loaded")).toBeVisible();\n  await page.getByRole("button").click();`,
      ),
    ).toStrictEqual([]);
    expect(
      await lint(
        `  await openTask(page);\n  await page.getByRole("button").click();`,
      ),
    ).toStrictEqual([]);
  });

  test("an action in a callback does not count as acting right after goto", async () => {
    expect(
      await lint(
        `  await page.goto("/a");\n  page.on("load", () => void page.getByRole("button").click());\n  await expect(page.getByText("Loaded")).toBeVisible();`,
      ),
    ).toStrictEqual([]);
  });
});

describe("dates and times are formatted only in components/date-time.tsx", () => {
  const eslint = new ESLint({ cwd: project });
  const clientDateTime = `"use client";

import { useFormatter } from "next-intl";

export function Probe({ at }: { at: number }) {
  const format = useFormatter();
  return <p>{format.dateTime(at)}</p>;
}
`;
  // Each no-restricted-syntax report, named by the restriction it comes from.
  const restricted = async (file, source) => {
    const [result] = await eslint.lintText(source, {
      filePath: join(project, file),
    });
    expect(result.fatalErrorCount).toBe(0);
    return result.messages
      .filter(({ ruleId }) => ruleId === "no-restricted-syntax")
      .map(({ message }) =>
        message.startsWith("Show a date or time")
          ? "date-time"
          : message.startsWith("List public API")
            ? "component-entry"
            : message,
      );
  };
  // Paths of files that exist: import/no-cycle cannot place a file that is not on disk.
  for (const { name, file, source, reported } of [
    {
      name: "format.dateTime in a Client Component is reported",
      file: "features/demo-task/components/task-list/index.tsx",
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
      name: "relative times and numbers still format anywhere",
      file: "features/demo-task/components/task-list/index.tsx",
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
});
