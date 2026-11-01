import type { Metadata } from "next";
// This page is outside [locale] and can't read the locale, so it can't use the
// Link from @/lib/i18n/navigation. The proxy resolves `/` to the user's
// language.
// eslint-disable-next-line no-restricted-imports -- reason in the comment above
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { routing } from "@/lib/i18n/routing";

import { fontVariables } from "./fonts";

import "./globals.css";

// Rendered when no route matches, an unsupported locale prefix included. It is
// outside the root layout and can't read the locale, so it uses the default.
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
