"use client";

import { useLocale } from "next-intl";

import { cn } from "@/lib/cn";
import { getPathname } from "@/lib/i18n-navigation";
import { LOCALE_NAMES, routing } from "@/lib/i18n-routing";

const itemClassName =
  "rounded-control px-2 py-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

interface LocaleItemsProps {
  /** 当前页面不带 locale 的地址，含 query。不传时其他语言也只显示文字，用作链接就绪前的占位。 */
  href?: string;
}

/**
 * 当前语言显示为文字，其他语言各一个指向 `href` 在那种语言下的链接。
 *
 * 链接是整页跳转的 `<a>`，不用 next-intl 的 `Link`：切到默认 locale 时地址带前缀（`/zh/...`），proxy 记下选择后
 * 跳到不带前缀的地址。客户端导航和 prefetch 会把这段跳转当作 RSC 请求发出，Next 再补一次跳转加上 `_rsc` 参数，
 * 浏览器按页面 URL 缓存这次跳转，之后前进后退到这个页面时地址栏会带上 `_rsc`。
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
        href={getPathname({ href, locale, forcePrefix: true })}
        lang={locale}
        hrefLang={locale}
        className={itemClassName}
      >
        {name}
      </a>
    );
  });
}
