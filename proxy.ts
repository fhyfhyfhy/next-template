import createMiddleware from "next-intl/middleware";

import { routing } from "@/lib/i18n/routing";

/**
 * 按 URL 前缀、`NEXT_LOCALE` cookie、`Accept-Language` 的顺序决定 locale：默认 locale 的请求 rewrite 到
 * `/{locale}/...`，其他 locale 缺前缀时重定向补上（docs/adr/0002-locale-routing-as-needed-prefix.md）。
 */
export default createMiddleware(routing);

export const config = {
  // 跳过 Next 内部路径和带扩展名的静态文件。
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
