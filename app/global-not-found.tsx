import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { routing } from "@/lib/i18n/routing";

import { fontVariables } from "./fonts";

import "./globals.css";

// 没有匹配任何路由时渲染。它在根 layout 之外，读不到 `[locale]`，只能用默认 locale。
const locale = routing.defaultLocale;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "app" });
  return { title: t("globalNotFound.title") };
}

export default async function GlobalNotFound() {
  const t = await getTranslations({ locale, namespace: "app" });
  return (
    <html lang={locale} className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <main className="mx-auto max-w-xl px-5 py-24 text-center">
          <h1 className="text-3xl font-medium tracking-tight">
            {t("globalNotFound.title")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("globalNotFound.description")}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            {t("globalNotFound.home")}
          </Link>
        </main>
      </body>
    </html>
  );
}
