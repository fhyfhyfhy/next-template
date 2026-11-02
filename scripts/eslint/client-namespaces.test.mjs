import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { ESLint } from "eslint";
import nextTs from "eslint-config-next/typescript";
import { expect, onTestFinished, test } from "vitest";

import createI18nPlugin from "./i18n-plugin.mjs";

const { parser } = nextTs.find(
  (config) => config.languageOptions?.parser,
).languageOptions;
const SOURCE = "**/*.{js,jsx,ts,tsx,mjs,cjs}";

const CLIENT_MESSAGES = `import type { ReactNode } from "react";
interface Props { namespaces: string[]; children: ReactNode }
export function RootClientMessages({ children }: Props) { return children; }
export function ClientMessages({ children }: Props) { return children; }
`;

const ROOT_LAYOUT = (
  namespaces = ["app"],
) => `import type { ReactNode } from "react";
import { RootClientMessages } from "@/lib/i18n/client-messages";
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html><body>
      <RootClientMessages namespaces={${JSON.stringify(namespaces)}}>{children}</RootClientMessages>
    </body></html>
  );
}
`;

const LAYOUT = (
  namespaces,
  body = "{children}",
) => `import type { ReactNode } from "react";
import { ClientMessages } from "@/lib/i18n/client-messages";
export default function Layout({ children }: { children: ReactNode }) {
  return <ClientMessages namespaces={${JSON.stringify(namespaces)}}>${body}</ClientMessages>;
}
`;

// Client Component：用 namespace 渲染一段文字，extra 放额外的 import 或代码。
const CLIENT = (name, namespace, extra = "") => `"use client";
import { useTranslations } from "next-intl";
${extra}
export function ${name}() {
  const t = useTranslations("${namespace}");
  return <p>{t("title")}</p>;
}
`;

const PAGE = (imports, jsx) => `${imports}
export default function Page() {
  return <main>${jsx}</main>;
}
`;

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "client-namespaces-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, source] of Object.entries({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "esnext",
        moduleResolution: "bundler",
        jsx: "preserve",
        paths: { "@/*": ["./*"] },
      },
    }),
    "package.json": JSON.stringify({ name: "fixture", private: true }),
    "lib/i18n/client-messages.tsx": CLIENT_MESSAGES,
    "app/layout.tsx": ROOT_LAYOUT(),
    ...files,
  })) {
    if (source === null) continue;
    const filename = join(root, file);
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename, source, "utf8");
  }
  return root;
}

function eslintFor(root, fix = false) {
  return new ESLint({
    cwd: root,
    overrideConfigFile: true,
    fix,
    errorOnUnmatchedPattern: false,
    overrideConfig: [
      {
        files: [SOURCE],
        languageOptions: {
          parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { i18n: createI18nPlugin(root) },
        rules: { "i18n/client-namespaces": "error" },
      },
    ],
  });
}

// 每个有问题的文件对应一组 "messageId namespace"，没有 namespace 的只写 messageId。
function summarize(root, results) {
  const summary = {};
  for (const result of results) {
    if (!result.messages.length) continue;
    summary[relative(root, result.filePath).split(sep).join("/")] =
      result.messages.map((message) => {
        if (!message.messageId) return message.message;
        const namespace = message.message.match(/^[^"]*"([^"]+)"/)?.[1];
        return namespace
          ? `${message.messageId} ${namespace}`
          : message.messageId;
      });
  }
  return summary;
}

async function lint(root, eslint = eslintFor(root)) {
  return summarize(root, await eslint.lintFiles([SOURCE]));
}

async function fix(root) {
  const results = await eslintFor(root, true).lintFiles([SOURCE]);
  await ESLint.outputFixes(results);
  return summarize(root, results);
}

const read = (root, file) => readFileSync(join(root, file), "utf8");

test("每层发全了就不报错；Server Component 里用到的 namespace 不需要下发", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(
      `import { Greeting } from "@/components/greeting";
import { useTranslations } from "next-intl";
function Server() { const t = useTranslations("server-only"); return <p>{t("x")}</p>; }`,
      "<Greeting /><Server />",
    ),
    "components/greeting.tsx": CLIENT("Greeting", "app.greeting"),
  });
  expect(await lint(root)).toStrictEqual({});
});

test("缺的 namespace 报在包着用到它的组件的那层 ClientMessages 上，--fix 补进那一层", async () => {
  const root = fixture({
    "app/(shop)/layout.tsx": LAYOUT(["shop"]),
    "app/(shop)/cart/page.tsx": PAGE(
      `import { Cart } from "@/features/cart/cart";
import { Shop } from "@/features/cart/shop";`,
      "<Cart /><Shop />",
    ),
    "features/cart/cart.tsx": CLIENT("Cart", "cart"),
    "features/cart/shop.tsx": CLIENT("Shop", "shop"),
    "app/page.tsx": PAGE("", ""),
    "components/greeting.tsx": null,
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["unused app"],
    "app/(shop)/layout.tsx": ["missing cart"],
  });
  await fix(root);
  expect(read(root, "app/(shop)/layout.tsx")).toContain(
    'namespaces={["shop", "cart"]}',
  );
  expect(read(root, "app/layout.tsx")).toContain("namespaces={[]}");
  expect(await lint(root)).toStrictEqual({});
});

test("外层已经发过的和没人用的 namespace 报错，--fix 删掉", async () => {
  const root = fixture({
    "app/(shop)/layout.tsx": LAYOUT(["app", "shop", "shop", "unused"]),
    "app/(shop)/page.tsx": PAGE(
      `import { Shop } from "./shop";
import { Header } from "./header";`,
      "<Shop /><Header />",
    ),
    "app/(shop)/shop.tsx": CLIENT("Shop", "shop"),
    "app/(shop)/header.tsx": CLIENT("Header", "app"),
  });
  expect(await lint(root)).toStrictEqual({
    "app/(shop)/layout.tsx": [
      "repeated app",
      "duplicate shop",
      "unused unused",
    ],
  });
  await fix(root);
  expect(read(root, "app/(shop)/layout.tsx")).toContain(
    'namespaces={["shop"]}',
  );
});

test("没写指令的组件：被 Server 文件引入时在服务端渲染，被 Client 文件引入时才要下发", async () => {
  const server = fixture({
    "app/page.tsx": PAGE(
      `import { Shared } from "./shared";
import { Greeting } from "./greeting";`,
      "<Shared /><Greeting />",
    ),
    "app/shared.tsx": CLIENT("Shared", "shared").replace('"use client";', ""),
    "app/greeting.tsx": CLIENT("Greeting", "app"),
  });
  expect(await lint(server)).toStrictEqual({});

  const client = fixture({
    "app/page.tsx": PAGE(`import { Panel } from "./panel";`, "<Panel />"),
    "app/panel.tsx": CLIENT(
      "Panel",
      "app",
      'import { Shared } from "./shared";',
    ).replace("<p>", "<p><Shared />"),
    "app/shared.tsx": CLIENT("Shared", "shared").replace('"use client";', ""),
  });
  expect(await lint(client)).toStrictEqual({
    "app/layout.tsx": ["missing shared"],
  });
});

test("动态 import 都算：next/dynamic、React.lazy、事件处理里的 import()", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(
      `import dynamic from "next/dynamic";
import { Panel } from "./panel";
const Chart = dynamic(() => import("./chart"));`,
      "<Chart /><Panel />",
    ),
    "app/chart.tsx": CLIENT("Chart", "chart"),
    "app/panel.tsx": CLIENT(
      "Panel",
      "app",
      `import { lazy } from "react";
const Editor = lazy(() => import("./editor"));
export async function load() { return import("./exporter"); }`,
    ),
    "app/editor.tsx": CLIENT("Editor", "editor"),
    "app/exporter.tsx": CLIENT("Exporter", "exporter"),
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["missing chart", "missing editor", "missing exporter"],
  });
});

test("带变量的动态 import 按 bundler 的做法展开成目录下所有匹配的文件", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(`import { Widgets } from "./widgets";`, "<Widgets />"),
    "app/widgets.tsx": CLIENT(
      "Widgets",
      "app",
      "export const load = (name: string) => import(`./widgets/${name}.tsx`);",
    ),
    "app/widgets/a.tsx": CLIENT("A", "a"),
    "app/widgets/nested/b.tsx": CLIENT("B", "b"),
    "app/widgets/c.ts": "export const c = 1;",
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["missing a", "missing b"],
  });
});

test("分析不了的写法直接报错，不悄悄跳过", async () => {
  const root = fixture({
    "app/page.tsx": PAGE("", ""),
    "app/docs/page.mdx": "# Docs",
    "components/bad.tsx": `"use client";
import { useTranslations } from "next-intl";
import * as intl from "next-intl";
import { useExtracted } from "next-intl";
import Doc from "./doc.mdx";
export function Bad({ namespace, name }: { namespace: "app"; name: string }) {
  const a = useTranslations(namespace);
  const b = useTranslations();
  const c = intl.useTranslations(namespace);
  const alias = useTranslations;
  const { useTranslations: useT } = intl;
  const d = intl["useTranslations"]("app");
  void import(name);
  void import(\`\${name}/x\`);
  void require(name);
  void import("next-intl");
  void require.context("./widgets", true);
  void import.meta.glob("./widgets/*.tsx");
  return <p>{a("x")}{b("app.x")}{c("x")}{d("x")}{String(alias)}{String(useT)}</p>;
}
`,
    "components/reexport.ts": `export { useTranslations } from "next-intl";`,
    "components/star.ts": `export * from "next-intl";`,
    "components/namespace.ts": `export * as intl from "next-intl";`,
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["mdxRoute", "unused app"],
    "components/bad.tsx": [
      "unsupported",
      "mdx",
      "literalNamespace",
      "missingNamespace",
      "literalNamespace",
      "indirectUse",
      "indirectUse",
      "indirectUse",
      "dynamicImport",
      "dynamicImport",
      "dynamicImport",
      "indirectUse",
      "dynamicImport",
      "dynamicImport",
    ],
    "components/reexport.ts": ["indirectUse"],
    "components/star.ts": ["indirectUse"],
    "components/namespace.ts": ["indirectUse"],
  });
});

test("从 use-intl 导入的 useTranslations 同样算", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(
      `import { Greeting } from "./greeting";`,
      "<Greeting />",
    ),
    "app/greeting.tsx": CLIENT("Greeting", "greeting").replace(
      'from "next-intl"',
      'from "use-intl"',
    ),
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["unused app", "missing greeting"],
  });
});

test("经过 feature 入口时只沿用到的导出走，export * 也一样", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(
      `import { A } from "@/features/named";
import { C } from "@/features/star";`,
      "<A /><C />",
    ),
    "features/named/index.ts": `export { A } from "./a";
export { B } from "./b";`,
    "features/named/a.tsx": CLIENT("A", "a"),
    "features/named/b.tsx": CLIENT("B", "b"),
    "features/star/index.ts": `export * from "./c";
export * from "./d";`,
    "features/star/c.tsx": CLIENT("C", "c"),
    "features/star/d.tsx": CLIENT("D", "d"),
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["unused app", "missing a", "missing c"],
  });
});

test("Client 端调用的 Server Action 按服务端继续走：它自己用的文案不算，它返回的 Client Component 算；类型 import 不往下走", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(`import { Form } from "./form";`, "<Form />"),
    "app/form.tsx": CLIENT(
      "Form",
      "app",
      `import { save } from "./actions";
import type { Props } from "./typed";
import { type Other } from "./typed-too";
export const action = save;`,
    ),
    "app/actions.tsx": `"use server";
import { useTranslations } from "next-intl";
import { Toast } from "./toast";
export async function save() {
  useTranslations("action");
  return <Toast />;
}`,
    "app/toast.tsx": CLIENT("Toast", "toast"),
    "app/typed.tsx": CLIENT("Typed", "typed") + "export type Props = {};",
    "app/typed-too.tsx":
      CLIENT("TypedToo", "typed-too") + "export type Other = {};",
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["missing toast"],
  });
});

test("ClientMessages 只管元素里面渲染的东西；同文件的组件按它被渲染的位置算", async () => {
  const root = fixture({
    "app/page.tsx": `import { ClientMessages } from "@/lib/i18n/client-messages";
import { Inside } from "./inside";
import { Outside } from "./outside";
function Panel() { return <Inside />; }
export default function Page() {
  return (
    <main>
      <Outside />
      <ClientMessages namespaces={["inside"]}><Panel /></ClientMessages>
    </main>
  );
}
`,
    "app/inside.tsx": CLIENT("Inside", "inside"),
    "app/outside.tsx": CLIENT("Outside", "outside"),
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["unused app", "missing outside"],
  });
});

test("layout 把 children 渲染在 ClientMessages 外面时报错，不管 props 怎么取；看不出来时也报错", async () => {
  const layout = (
    signature,
    children,
    wrap = (body) => body,
  ) => `import type { ReactNode } from "react";
import { ClientMessages } from "@/lib/i18n/client-messages";
import { Header } from "@/components/header";
const withTracking = <P,>(component: (props: P) => ReactNode) => component;
export default ${wrap(`function Layout(${signature}) {
  return <><ClientMessages namespaces={["shop"]}><Header /></ClientMessages>${children}</>;
}`)}
`;
  const root = fixture({
    "components/header.tsx": CLIENT("Header", "shop"),
    "app/(destructured)/layout.tsx": layout(
      "{ children }: { children: ReactNode }",
      "{children}",
    ),
    "app/(props)/layout.tsx": layout(
      "props: { children: ReactNode }",
      "{props.children}",
    ),
    "app/(renamed)/layout.tsx": layout(
      "{ children: content }: { children: ReactNode }",
      "{content}",
    ),
    "app/(wrapped)/layout.tsx": layout(
      "{ children }: { children: ReactNode }",
      "",
      (body) => `withTracking(${body})`,
    ),
    "app/page.tsx": PAGE(
      `import { Greeting } from "./greeting";`,
      "<Greeting />",
    ),
    "app/greeting.tsx": CLIENT("Greeting", "app"),
  });
  expect(await lint(root)).toStrictEqual({
    "app/(destructured)/layout.tsx": ["childrenOutside"],
    "app/(props)/layout.tsx": ["childrenOutside"],
    "app/(renamed)/layout.tsx": ["childrenOutside"],
    "app/(wrapped)/layout.tsx": ["childrenUnknown"],
  });
});

test("根 layout 要用 RootClientMessages，其他地方不能用；ClientMessages 只能放在 layout、template、page", async () => {
  const root = fixture({
    "app/layout.tsx": `import type { ReactNode } from "react";
import { Theme } from "./theme";
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html><body><Theme />{children}</body></html>;
}
`,
    "app/theme.tsx": CLIENT("Theme", "theme"),
    "app/(shop)/layout.tsx": `import type { ReactNode } from "react";
import { RootClientMessages } from "@/lib/i18n/client-messages";
export default function Layout({ children }: { children: ReactNode }) {
  return <RootClientMessages namespaces={[]}>{children}</RootClientMessages>;
}
`,
    "app/(shop)/loading.tsx": `import { ClientMessages } from "@/lib/i18n/client-messages";
export default function Loading() { return <ClientMessages namespaces={[]}>…</ClientMessages>; }
`,
    "features/shop/panel.tsx": `import { ClientMessages } from "@/lib/i18n/client-messages";
export function Panel() { return <ClientMessages namespaces={[]}>…</ClientMessages>; }
`,
    "app/(shop)/page.tsx": PAGE(
      `import { ClientMessages } from "@/lib/i18n/client-messages";
const list = ["shop"] as const;`,
      "<ClientMessages namespaces={[...list]}>…</ClientMessages>",
    ),
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["rootRequired", "outside theme"],
    "app/(shop)/layout.tsx": ["rootPlacement"],
    "app/(shop)/loading.tsx": ["placement"],
    "app/(shop)/page.tsx": ["literalList"],
    "features/shop/panel.tsx": ["placement"],
  });
});

test("error.tsx 这类 Client 文件的 namespace 算在所在 layout 上；global-error 在所有 ClientMessages 外面", async () => {
  const root = fixture({
    "app/(shop)/layout.tsx": LAYOUT(["shop"]),
    "app/(shop)/page.tsx": PAGE(`import { Shop } from "./shop";`, "<Shop />"),
    "app/(shop)/shop.tsx": CLIENT("Shop", "shop"),
    "app/(shop)/error.tsx": CLIENT("ShopError", "shop-error").replace(
      "export function ShopError",
      "export default function ShopError",
    ),
    "app/global-error.tsx": CLIENT("GlobalError", "app").replace(
      "export function GlobalError",
      "export default function GlobalError",
    ),
    "app/page.tsx": PAGE(
      `import { Greeting } from "./greeting";`,
      "<Greeting />",
    ),
    "app/greeting.tsx": CLIENT("Greeting", "app"),
  });
  expect(await lint(root)).toStrictEqual({
    "app/(shop)/layout.tsx": ["missing shop-error"],
    "app/global-error.tsx": ["outside app"],
  });
});

test("template 的 ClientMessages 包着 page 和平行路由的 slot", async () => {
  const root = fixture({
    "app/(shop)/layout.tsx": `import type { ReactNode } from "react";
import { ClientMessages } from "@/lib/i18n/client-messages";
export default function Layout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return <ClientMessages namespaces={["shop"]}>{children}{modal}</ClientMessages>;
}
`,
    "app/(shop)/template.tsx": LAYOUT(["cart"]).replace("Layout", "Template"),
    "app/(shop)/page.tsx": PAGE(
      `import { Cart } from "./cart";
import { Shop } from "./shop";`,
      "<Cart /><Shop />",
    ),
    "app/(shop)/@modal/page.tsx": PAGE(
      `import { Cart } from "../cart";`,
      "<Cart />",
    ),
    "app/(shop)/cart.tsx": CLIENT("Cart", "cart"),
    "app/(shop)/shop.tsx": CLIENT("Shop", "shop"),
    "app/page.tsx": PAGE(
      `import { Greeting } from "./greeting";`,
      "<Greeting />",
    ),
    "app/greeting.tsx": CLIENT("Greeting", "app"),
  });
  expect(await lint(root)).toStrictEqual({});
});

test("workspace 包沿真实路径继续分析，第三方包不分析；只有类型声明、没有 JS 的包报错", async () => {
  const builtPackage = (name) =>
    JSON.stringify({
      name,
      exports: {
        ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
      },
    });
  const root = fixture({
    "packages/ui/package.json": JSON.stringify({
      name: "@acme/ui",
      exports: { ".": "./src/index.ts" },
      imports: { "#local": "./src/local.tsx" },
    }),
    "packages/ui/src/index.ts": `export { Button } from "./button";`,
    "packages/ui/src/button.tsx": CLIENT(
      "Button",
      "button",
      'import { Local } from "#local";',
    ).replace("<p>", "<p><Local />"),
    "packages/ui/src/local.tsx": CLIENT("Local", "local"),
    "packages/built/package.json": builtPackage("@acme/built"),
    "packages/built/dist/index.d.ts": "export declare function Built(): null;",
    "packages/built/dist/index.js": `"use client";
import { useTranslations } from "next-intl";
export function Built() { return useTranslations("built")("x"); }`,
    "packages/unbuilt/package.json": builtPackage("@acme/unbuilt"),
    "packages/unbuilt/dist/index.d.ts":
      "export declare function Unbuilt(): null;",
    "node_modules/vendor/package.json": JSON.stringify({
      name: "vendor",
      main: "index.js",
    }),
    "node_modules/vendor/index.js": `"use client";
import { useTranslations } from "next-intl";
export function Vendor() { return useTranslations("vendor")("x"); }`,
    "app/page.tsx": PAGE(
      `import { Button } from "@acme/ui";
import { Built } from "@acme/built";
import { Unbuilt } from "@acme/unbuilt";
import { Vendor } from "vendor";
import { Greeting } from "./greeting";`,
      "<Button /><Built /><Unbuilt /><Vendor /><Greeting />",
    ),
    "app/greeting.tsx": CLIENT("Greeting", "app"),
  });
  mkdirSync(join(root, "node_modules/@acme"), { recursive: true });
  for (const name of ["ui", "built", "unbuilt"])
    symlinkSync(
      join(root, "packages", name),
      join(root, "node_modules/@acme", name),
      "junction",
    );
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["missing built", "missing button", "missing local"],
    "app/page.tsx": ["unresolvedPackage @acme/unbuilt"],
  });
});

test("package.json imports：Client 端可能选中的分支都跟进去（包括 development），带 * 的 key 按 Node 的规则匹配", async () => {
  const shared = (name, namespace) =>
    CLIENT(name, namespace).replace('"use client";', "");
  const root = fixture({
    "package.json": JSON.stringify({
      name: "fixture",
      imports: {
        "#impl": {
          "react-server": "./lib/impl-server.tsx",
          development: "./lib/impl-dev.tsx",
          default: "./lib/impl-browser.tsx",
        },
        "#widgets/*": "./lib/widgets/*.tsx",
      },
    }),
    "lib/impl-server.tsx": shared("Impl", "impl-server"),
    "lib/impl-dev.tsx": shared("Impl", "impl-dev"),
    "lib/impl-browser.tsx": shared("Impl", "impl-browser"),
    "lib/widgets/star.tsx": shared("Star", "star"),
    "app/page.tsx": PAGE(`import { Panel } from "./panel";`, "<Panel />"),
    "app/panel.tsx": CLIENT(
      "Panel",
      "app",
      `import { Impl } from "#impl";
import { Star } from "#widgets/star";`,
    ).replace("<p>", "<p><Impl /><Star />"),
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": [
      "missing impl-browser",
      "missing impl-dev",
      "missing star",
    ],
  });
});

test("依赖成环时也能走完；src/app 和多个根 layout 都适用", async () => {
  const root = fixture({
    "app/layout.tsx": null,
    "src/app/(a)/layout.tsx": ROOT_LAYOUT([]),
    "src/app/(a)/page.tsx": PAGE(`import { A } from "../../loop/a";`, "<A />"),
    "src/app/(b)/layout.tsx": `export default function Layout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
`,
    "src/app/(b)/b/page.tsx": PAGE("", ""),
    "src/loop/a.tsx": CLIENT("A", "a", 'import { B } from "./b";').replace(
      "<p>",
      "<p><B />",
    ),
    "src/loop/b.tsx": CLIENT("B", "b", 'import { A } from "./a";').replace(
      "<p>",
      "<p><A />",
    ),
  });
  expect(await lint(root)).toStrictEqual({
    "src/app/(a)/layout.tsx": ["missing a", "missing b"],
    "src/app/(b)/layout.tsx": ["rootRequired"],
  });
});

test("编辑器里未保存的内容参与分析，磁盘上的文件变了结果也跟着变", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(
      `import { Greeting } from "./greeting";`,
      "<Greeting />",
    ),
    "app/greeting.tsx": CLIENT("Greeting", "app"),
  });
  const eslint = eslintFor(root);
  expect(await lint(root, eslint)).toStrictEqual({});

  const [unsaved] = await eslint.lintText(
    PAGE(
      `import { Greeting } from "./greeting";
import { Cart } from "./cart";`,
      "<Greeting /><Cart />",
    ),
    { filePath: join(root, "app/page.tsx") },
  );
  expect(unsaved.messages).toStrictEqual([]);
  writeFileSync(join(root, "app/cart.tsx"), CLIENT("Cart", "cart"), "utf8");
  const [layout] = await eslint.lintText(read(root, "app/layout.tsx"), {
    filePath: join(root, "app/layout.tsx"),
  });
  // 磁盘上的 page 还没引入 Cart，所以根 layout 不缺 cart。
  expect(layout.messages).toStrictEqual([]);

  writeFileSync(
    join(root, "app/greeting.tsx"),
    CLIENT("Greeting", "app", 'import { Cart } from "./cart";').replace(
      "<p>",
      "<p><Cart />",
    ),
    "utf8",
  );
  expect(await lint(root, eslint)).toStrictEqual({
    "app/layout.tsx": ["missing cart"],
  });
});
