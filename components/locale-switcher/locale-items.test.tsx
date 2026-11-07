import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";

import type { Locale } from "@/lib/i18n/routing";

import { LocaleItems } from "./locale-items";

// 部署在某个路径下的项目在 lib/base-path.ts 里设置它。
vi.mock("@/lib/base-path", () => ({ BASE_PATH: "/base" }));

function linkHrefs(locale: Locale, href: string) {
  const html = renderToString(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <LocaleItems href={href} />
    </NextIntlClientProvider>,
  );
  return [...html.matchAll(/href="([^"]*)"/g)].map(([, value]) => value);
}

test("设置了 basePath 时，每个语言链接都以它开头", () => {
  expect(linkHrefs("zh", "/ui?component=select")).toStrictEqual([
    "/base/en/ui?component=select",
  ]);
});

test("切到默认 locale 的链接也带前缀，proxy 才会记下选择", () => {
  expect(linkHrefs("en", "/tasks")).toStrictEqual(["/base/zh/tasks"]);
});

test("根路径的链接不带结尾的 /，query 照旧", () => {
  expect(linkHrefs("zh", "/")).toStrictEqual(["/base/en"]);
  expect(linkHrefs("zh", "/?tab=a")).toStrictEqual(["/base/en?tab=a"]);
});
