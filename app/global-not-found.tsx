import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { StatusMessage } from "@/components/status-message";
import { routing } from "@/lib/i18n/routing";

import { fontVariables } from "./fonts";

import "./globals.css";

// 没有匹配任何路由时渲染。它在根 layout 之外，读不到 `[locale]`，只能用默认 locale。
const locale = routing.defaultLocale;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale });
  // 它在 [locale] 的 layout 之外，用不上那里的标题模板，自己按同一个格式拼。
  return {
    title: t("app.metadata.titleTemplate", {
      page: t("app.globalNotFound.title"),
      app: t("app.name"),
    }),
  };
}

export default async function GlobalNotFound() {
  const t = await getTranslations({ locale });
  return (
    <html lang={locale} className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <main className="mx-auto max-w-xl px-5 py-8">
          <StatusMessage
            title={t("app.globalNotFound.title")}
            description={t("app.globalNotFound.description")}
            action={
              <Link href="/" className="text-sm text-primary hover:underline">
                {t("app.globalNotFound.home")}
              </Link>
            }
          />
        </main>
      </body>
    </html>
  );
}
