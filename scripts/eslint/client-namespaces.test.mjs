import { mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ESLint } from "eslint";
import { expect, test } from "vitest";

import {
  fixture as projectFixture,
  parser,
  writeFile,
} from "./fixture-test-helpers.mjs";
import createI18nPlugin from "./i18n-plugin.mjs";

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

// Client Component：渲染 namespace 下的一段文字，extra 放额外的 import 或代码。它用到的 namespace 由文件所在的
// owner 决定（features/<name> 是 <name>，app/ 是 app，components/ 是 ui），所以 namespace 要和放它的目录一致。
const CLIENT = (name, namespace, extra = "") => `"use client";
import { useTranslations } from "next-intl";
${extra}
export function ${name}() {
  const t = useTranslations();
  return <p>{t("${namespace}.title")}</p>;
}
`;

// 没写指令的组件：被谁引入就在哪一端渲染。
const SHARED = (name, namespace, extra = "") =>
  CLIENT(name, namespace, extra).replace('"use client";\n', "");

const PAGE = (imports, jsx) => `${imports}
export default function Page() {
  return <main>${jsx}</main>;
}
`;

// 带 ClientMessages 和下发 app namespace 的根 layout 的项目；`files` 里源码为 null 的文件不写，可以去掉其中一个。
const fixture = (files) =>
  projectFixture(
    {
      "package.json": JSON.stringify({ name: "fixture", private: true }),
      "lib/i18n/client-messages.tsx": CLIENT_MESSAGES,
      "app/layout.tsx": ROOT_LAYOUT(),
      ...files,
    },
    { jsx: "preserve" },
  );

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

test("每层发全了就不报错；Server Component 里读的文案不需要下发", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(
      `import { Greeting } from "./greeting";
import { Server } from "@/features/server-only/server";`,
      "<Greeting /><Server />",
    ),
    "app/greeting.tsx": CLIENT("Greeting", "app"),
    "features/server-only/server.tsx": SHARED("Server", "server-only"),
  });
  expect(await lint(root)).toStrictEqual({});
});

test("namespace 按读文案的模块所在的 owner 算：features/<name>、app、components 对应 ui；接收 Translator 的函数也算读文案", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(`import { Panel } from "./panel";`, "<Panel />"),
    "app/panel.tsx": CLIENT(
      "Panel",
      "app",
      `import { Button } from "@/components/button";
import { Badge } from "@/features/badge/badge";
import { saveOptions } from "@/features/save/options";
import { formatPrice } from "@/features/price/format";
export const options = saveOptions;
export const price = formatPrice;`,
    ).replace("<p>", "<p><Button /><Badge />"),
    "components/button.tsx": CLIENT("Button", "ui"),
    "features/badge/badge.tsx": `export function Badge() { return <span />; }`,
    "features/save/options.ts": `import type { Translator } from "@/lib/i18n/translator";
export const saveOptions = (t: Translator) => ({ errorMessage: t("save.failed") });`,
    "features/price/format.ts": `export const formatPrice = (value: number) => String(value);`,
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["missing save", "missing ui"],
  });
});

test("缺的 namespace 报在包着用到它的组件的那层 ClientMessages 上，--fix 补进那一层", async () => {
  const root = fixture({
    "app/(shop)/layout.tsx": LAYOUT(["shop"]),
    "app/(shop)/cart/page.tsx": PAGE(
      `import { Cart } from "@/features/cart/cart";
import { Shop } from "@/features/shop/shop";`,
      "<Cart /><Shop />",
    ),
    "features/cart/cart.tsx": CLIENT("Cart", "cart"),
    "features/shop/shop.tsx": CLIENT("Shop", "shop"),
    "app/page.tsx": PAGE("", ""),
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
      `import { Shop } from "@/features/shop/shop";
import { Header } from "./header";`,
      "<Shop /><Header />",
    ),
    "features/shop/shop.tsx": CLIENT("Shop", "shop"),
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
      `import { Shared } from "@/features/shared/shared";
import { Greeting } from "./greeting";`,
      "<Shared /><Greeting />",
    ),
    "features/shared/shared.tsx": SHARED("Shared", "shared"),
    "app/greeting.tsx": CLIENT("Greeting", "app"),
  });
  expect(await lint(server)).toStrictEqual({});

  const client = fixture({
    "app/page.tsx": PAGE(`import { Panel } from "./panel";`, "<Panel />"),
    "app/panel.tsx": CLIENT(
      "Panel",
      "app",
      'import { Shared } from "@/features/shared/shared";',
    ).replace("<p>", "<p><Shared />"),
    "features/shared/shared.tsx": SHARED("Shared", "shared"),
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
const Chart = dynamic(() => import("@/features/chart/chart"));`,
      "<Chart /><Panel />",
    ),
    "features/chart/chart.tsx": CLIENT("Chart", "chart"),
    "app/panel.tsx": CLIENT(
      "Panel",
      "app",
      `import { lazy } from "react";
const Editor = lazy(() => import("@/features/editor/editor"));
export async function load() { return import("@/features/exporter/exporter"); }`,
    ),
    "features/editor/editor.tsx": CLIENT("Editor", "editor"),
    "features/exporter/exporter.tsx": CLIENT("Exporter", "exporter"),
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
      "export const load = (name: string) => import(`@/features/${name}.tsx`);",
    ),
    "features/a/widget.tsx": CLIENT("A", "a"),
    "features/b/nested/widget.tsx": CLIENT("B", "b"),
    "features/c/widget.ts": "export const c = 1;",
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
export function Bad({ name }: { name: string }) {
  const b = useTranslations();
  const c = intl.useTranslations();
  const alias = useTranslations;
  const { useTranslations: useT } = intl;
  const d = intl["useTranslations"]();
  void import(name);
  void import(\`\${name}/x\`);
  void require(name);
  void import("next-intl");
  void require.context("./widgets", true);
  void import.meta.glob("./widgets/*.tsx");
  return <p>{b("ui.x")}{c("ui.x")}{d("ui.x")}{String(alias)}{String(useT)}</p>;
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
      `import { Greeting } from "@/features/greeting/greeting";`,
      "<Greeting />",
    ),
    "features/greeting/greeting.tsx": CLIENT("Greeting", "greeting").replace(
      'from "next-intl"',
      'from "use-intl"',
    ),
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["unused app", "missing greeting"],
  });
});

test("经过入口时只沿用到的导出走，export * 也一样", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(
      `import { A } from "@/features/named";
import { C } from "@/features/star";`,
      "<A /><C />",
    ),
    "features/named/index.ts": `export { A } from "@/features/a/a";
export { B } from "@/features/b/b";`,
    "features/a/a.tsx": CLIENT("A", "a"),
    "features/b/b.tsx": CLIENT("B", "b"),
    "features/star/index.ts": `export * from "@/features/c/c";
export * from "@/features/d/d";`,
    "features/c/c.tsx": CLIENT("C", "c"),
    "features/d/d.tsx": CLIENT("D", "d"),
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["unused app", "missing a", "missing c"],
  });
});

test("Client 端调用的 Server Action 按服务端继续走：它自己读的文案不算，它返回的 Client Component 算；类型 import 不往下走", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(`import { Form } from "./form";`, "<Form />"),
    "app/form.tsx": CLIENT(
      "Form",
      "app",
      `import { save } from "@/features/action/actions";
import type { Props } from "@/features/typed/typed";
import { type Other } from "@/features/typed-too/typed-too";
export const action = save;`,
    ),
    "features/action/actions.tsx": `"use server";
import { useTranslations } from "next-intl";
import { Toast } from "@/features/toast/toast";
export async function save() {
  useTranslations();
  return <Toast />;
}`,
    "features/toast/toast.tsx": CLIENT("Toast", "toast"),
    "features/typed/typed.tsx":
      CLIENT("Typed", "typed") + "export type Props = {};",
    "features/typed-too/typed-too.tsx":
      CLIENT("TypedToo", "typed-too") + "export type Other = {};",
  });
  expect(await lint(root)).toStrictEqual({
    "app/layout.tsx": ["missing toast"],
  });
});

test("ClientMessages 只管元素里面渲染的东西；同文件的组件按它被渲染的位置算", async () => {
  const root = fixture({
    "app/page.tsx": `import { ClientMessages } from "@/lib/i18n/client-messages";
import { Inside } from "@/features/inside/inside";
import { Outside } from "@/features/outside/outside";
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
    "features/inside/inside.tsx": CLIENT("Inside", "inside"),
    "features/outside/outside.tsx": CLIENT("Outside", "outside"),
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
import { Header } from "@/features/shop/header";
const withTracking = <P,>(component: (props: P) => ReactNode) => component;
export default ${wrap(`function Layout(${signature}) {
  return <><ClientMessages namespaces={["shop"]}><Header /></ClientMessages>${children}</>;
}`)}
`;
  const root = fixture({
    "features/shop/header.tsx": CLIENT("Header", "shop"),
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
import { Theme } from "@/features/theme/theme";
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html><body><Theme />{children}</body></html>;
}
`,
    "features/theme/theme.tsx": CLIENT("Theme", "theme"),
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

test("error.tsx 这类 Client 文件渲染的 namespace 算在所在 layout 上；global-error 在所有 ClientMessages 外面", async () => {
  const root = fixture({
    "app/(shop)/layout.tsx": LAYOUT(["shop"]),
    "app/(shop)/page.tsx": PAGE(
      `import { Shop } from "@/features/shop/shop";`,
      "<Shop />",
    ),
    "features/shop/shop.tsx": CLIENT("Shop", "shop"),
    "app/(shop)/error.tsx": `"use client";
import { ShopError } from "@/features/shop-error/shop-error";
export default function Error() { return <ShopError />; }
`,
    "features/shop-error/shop-error.tsx": CLIENT("ShopError", "shop-error"),
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
      `import { Cart } from "@/features/cart/cart";
import { Shop } from "@/features/shop/shop";`,
      "<Cart /><Shop />",
    ),
    "app/(shop)/@modal/page.tsx": PAGE(
      `import { Cart } from "@/features/cart/cart";`,
      "<Cart />",
    ),
    "features/cart/cart.tsx": CLIENT("Cart", "cart"),
    "features/shop/shop.tsx": CLIENT("Shop", "shop"),
    "app/page.tsx": PAGE(
      `import { Greeting } from "./greeting";`,
      "<Greeting />",
    ),
    "app/greeting.tsx": CLIENT("Greeting", "app"),
  });
  expect(await lint(root)).toStrictEqual({});
});

test("workspace 包和第三方包里的模块不属于任何 owner，不算 namespace；只有类型声明、没有 JS 的包报错", async () => {
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
export function Built() { return useTranslations()("built.x"); }`,
    "packages/unbuilt/package.json": builtPackage("@acme/unbuilt"),
    "packages/unbuilt/dist/index.d.ts":
      "export declare function Unbuilt(): null;",
    "node_modules/vendor/package.json": JSON.stringify({
      name: "vendor",
      main: "index.js",
    }),
    "node_modules/vendor/index.js": `"use client";
import { useTranslations } from "next-intl";
export function Vendor() { return useTranslations()("vendor.x"); }`,
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
    "app/page.tsx": ["unresolvedPackage @acme/unbuilt"],
  });
});

test("package.json imports：Client 端可能选中的分支都跟进去（包括 development），带 * 的 key 按 Node 的规则匹配", async () => {
  const root = fixture({
    "package.json": JSON.stringify({
      name: "fixture",
      imports: {
        "#impl": {
          "react-server": "./features/impl-server/impl.tsx",
          development: "./features/impl-dev/impl.tsx",
          default: "./features/impl-browser/impl.tsx",
        },
        "#widgets/*": "./features/*/widget.tsx",
      },
    }),
    "features/impl-server/impl.tsx": SHARED("Impl", "impl-server"),
    "features/impl-dev/impl.tsx": SHARED("Impl", "impl-dev"),
    "features/impl-browser/impl.tsx": SHARED("Impl", "impl-browser"),
    "features/star/widget.tsx": SHARED("Star", "star"),
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
    "src/app/(a)/page.tsx": PAGE(
      `import { A } from "../../features/a/a";`,
      "<A />",
    ),
    "src/app/(b)/layout.tsx": `export default function Layout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
`,
    "src/app/(b)/b/page.tsx": PAGE("", ""),
    "src/features/a/a.tsx": CLIENT(
      "A",
      "a",
      'import { B } from "../b/b";',
    ).replace("<p>", "<p><B />"),
    "src/features/b/b.tsx": CLIENT(
      "B",
      "b",
      'import { A } from "../a/a";',
    ).replace("<p>", "<p><A />"),
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
import { Cart } from "@/features/cart/cart";`,
      "<Greeting /><Cart />",
    ),
    { filePath: join(root, "app/page.tsx") },
  );
  expect(unsaved.messages).toStrictEqual([]);
  writeFile(root, "features/cart/cart.tsx", CLIENT("Cart", "cart"));
  const [layout] = await eslint.lintText(read(root, "app/layout.tsx"), {
    filePath: join(root, "app/layout.tsx"),
  });
  // 磁盘上的 page 还没引入 Cart，所以根 layout 不缺 cart。
  expect(layout.messages).toStrictEqual([]);

  writeFile(
    root,
    "app/greeting.tsx",
    CLIENT(
      "Greeting",
      "app",
      'import { Cart } from "@/features/cart/cart";',
    ).replace("<p>", "<p><Cart />"),
  );
  expect(await lint(root, eslint)).toStrictEqual({
    "app/layout.tsx": ["missing cart"],
  });
});

test("无效配置不会回退到旧 resolver，修正后同一个 ESLint 可以恢复", async () => {
  const root = fixture({
    "app/page.tsx": PAGE(
      `import { Cart } from "@/features/cart/cart";`,
      "<Cart />",
    ),
    "app/layout.tsx": ROOT_LAYOUT([]),
    "features/cart/cart.tsx": CLIENT("Cart", "cart"),
  });
  const eslint = eslintFor(root);
  expect(await lint(root, eslint)).toStrictEqual({
    "app/layout.tsx": ["missing cart"],
  });
  const config = read(root, "tsconfig.json");
  writeFile(root, "tsconfig.json", "{");
  await expect(lint(root, eslint)).rejects.toThrow("'}' expected.");
  await expect(lint(root, eslint)).rejects.toThrow("'}' expected.");
  writeFile(root, "tsconfig.json", config);
  expect(await lint(root, eslint)).toStrictEqual({
    "app/layout.tsx": ["missing cart"],
  });
});
