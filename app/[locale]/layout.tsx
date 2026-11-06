import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { fontVariables } from "@/app/fonts";
import { Providers } from "@/app/providers";
import { RootClientMessages } from "@/lib/i18n/client-messages";
import { routing } from "@/lib/i18n/routing";

import "@/app/globals.css";

// Cache Components 要求每个 root param 至少预渲染一个值；每个 locale 各出一份静态页面。
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const name = t("app.metadata.title");
  return {
    // 子页面只给出自己的标题，比如任务名，后面按各语言的格式接上应用名。
    title: {
      default: name,
      template: t("app.metadata.titleTemplate", { page: "%s", app: name }),
    },
    description: t("app.metadata.description"),
  };
}

export default async function RootLayout({
  children,
}: LayoutProps<"/[locale]">) {
  return (
    <html
      lang={await getLocale()}
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="min-h-full">
        <RootClientMessages namespaces={["app", "ui"]}>
          <Providers>
            <div className="isolate min-h-dvh">{children}</div>
          </Providers>
        </RootClientMessages>
      </body>
    </html>
  );
}
