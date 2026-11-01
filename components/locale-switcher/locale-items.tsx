"use client";

import { useLocale } from "next-intl";

import { BASE_PATH } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { getPathname } from "@/lib/i18n/navigation";
import { type Locale, routing } from "@/lib/i18n/routing";

// Each language is named in that language, not translated into the current
// locale, so users recognize their own. Adding a locale makes the type check
// ask for its name.
const LOCALE_NAMES: Record<Locale, string> = {
  zh: "中文",
  en: "English",
};

const itemClassName =
  "rounded-control px-2 py-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

interface LocaleItemsProps {
  /**
   * The current page's address without the locale, query included. Without it
   * the other languages show as text too, a placeholder until the links are
   * ready.
   */
  href?: string;
}

/**
 * The current language shows as text; each other language is a link to `href`
 * in that language.
 *
 * The links are full-page `<a>` navigations, not next-intl's `Link`. Switching
 * to the default locale goes to its prefixed address (`/zh/...`), and the
 * proxy records the choice and redirects to the address without the prefix. A
 * client-side navigation or prefetch would send that redirect as an RSC
 * request, and Next would add one more redirect with an `_rsc` query. The
 * browser caches that redirect by the page URL, so going back or forward to the
 * page later shows `_rsc` in the address bar.
 */
export function LocaleItems({ href }: LocaleItemsProps) {
  const current = useLocale();
  return routing.locales.map((locale) => {
    const name = LOCALE_NAMES[locale];
    if (locale === current) {
      return (
        <span
          key={locale}
          lang={locale}
          aria-current="true"
          className={cn(itemClassName, "font-medium text-foreground")}
        >
          {name}
        </span>
      );
    }
    if (href === undefined) {
      return (
        <span key={locale} lang={locale} className={itemClassName}>
          {name}
        </span>
      );
    }
    return (
      <a
        key={locale}
        // A plain <a>, so the basePath that Next adds to its own links is ours to add.
        href={BASE_PATH + getPathname({ href, locale, forcePrefix: true })}
        lang={locale}
        hrefLang={locale}
        className={itemClassName}
      >
        {name}
      </a>
    );
  });
}
