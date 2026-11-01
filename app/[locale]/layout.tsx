import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ThemeProvider } from "next-themes";

import { fontVariables } from "@/app/fonts";
import { Providers } from "@/app/providers";
import { ClientMessages } from "@/lib/i18n/client-messages";
import { routing } from "@/lib/i18n/routing";

import "@/app/globals.css";

// Cache Components 要求每个 root param 至少预渲染一个值；每个 locale 各出一份静态页面。
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.metadata");
  return { title: t("title"), description: t("description") };
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClientMessages>
            <Providers>
              <div className="isolate min-h-dvh">{children}</div>
            </Providers>
          </ClientMessages>
        </ThemeProvider>
      </body>
    </html>
  );
}
