import type { Metadata } from "next";
// 这个页面在 [locale] 之外，读不到 locale，用不了 @/lib/i18n-navigation 的 Link；`/` 由 proxy 按用户的语言处理。
// eslint-disable-next-line no-restricted-imports -- 理由见上一行
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { routing } from "@/lib/i18n-routing";

import { fontVariables } from "./fonts";

import "./globals.css";

// 没有匹配任何路由（包括不支持的 locale 前缀）时渲染，它在根 layout 之外，读不到 locale，只能用默认 locale。
const locale = routing.defaultLocale;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "app.globalNotFound" });
  return { title: t("title") };
}

export default async function GlobalNotFound() {
  const t = await getTranslations({ locale, namespace: "app.globalNotFound" });
  return (
    <html lang={locale} className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <main className="mx-auto max-w-xl px-5 py-24 text-center">
          <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("description")}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            {t("home")}
          </Link>
        </main>
      </body>
    </html>
  );
}
