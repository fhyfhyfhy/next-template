import createMiddleware from "next-intl/middleware";

import { routing } from "@/lib/i18n/routing";

/**
 * 按 `NEXT_LOCALE` cookie、`Accept-Language`、默认 locale 的顺序决定访问者的语言，把请求 rewrite 到
 * `/{locale}/...`。带 locale 前缀的地址只来自语言切换器：记下这个 locale 后跳到不带前缀的地址
 * （docs/adr/0005-unprefixed-urls-in-visitor-locale.md）。
 */
export default createMiddleware(routing);

export const config = {
  // 跳过 Next 内部路径和带扩展名的静态文件。
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
