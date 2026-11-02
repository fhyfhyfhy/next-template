"use client";

import { useLocale } from "next-intl";

import { BASE_PATH } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { type Locale, routing } from "@/lib/i18n/routing";

// 每种语言用它自己的写法显示，不随当前 locale 翻译，用户才认得出自己的语言；加 locale 时类型检查会要求补上。
const LOCALE_NAMES: Record<Locale, string> = {
  zh: "中文",
  en: "English",
};

const itemClassName =
  "rounded-control px-2 py-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

interface LocaleItemsProps {
  /** 当前页面的地址，含 query，不含 basePath。不传时其他语言也只显示文字，用作链接就绪前的占位。 */
  href?: string;
}

/**
 * 当前语言显示为文字，其他语言各一个链接，切换到那种语言并停在 `href`。
 *
 * 链接是整页跳转的 `<a>`，不用 `next/link`：地址是 `/{locale}` 加上 `href`，proxy 把这个 locale 记成访问者的选择，
 * 再跳回 `href`（docs/adr/0005-unprefixed-urls-in-visitor-locale.md）。客户端导航和 prefetch 会把这段跳转当作
 * RSC 请求发出，Next 再补一次跳转加上 `_rsc` 参数，浏览器按页面 URL 缓存这次跳转，之后前进后退到这个页面时
 * 地址栏会带上 `_rsc`。整页跳转也清掉了客户端缓存的旧语言页面，它们和新语言的页面地址相同。
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
        href={switchHref(locale, href)}
        lang={locale}
        hrefLang={locale}
        className={itemClassName}
      >
        {name}
      </a>
    );
  });
}

/** 切换到 `locale` 的地址。普通的 `<a>` 要自己加 basePath，Next 只给它自己的链接加。根路径不带结尾的 `/`。 */
function switchHref(locale: Locale, href: string) {
  const path = href === "/" || href.startsWith("/?") ? href.slice(1) : href;
  return `${BASE_PATH}/${locale}${path}`;
}
