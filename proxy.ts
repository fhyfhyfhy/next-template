import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { DEMOS_SERVED } from "@/app/demos";
import { routing } from "@/lib/i18n/routing";

/**
 * 按 `NEXT_LOCALE` cookie、`Accept-Language`、默认 locale 的顺序决定访问者的语言，把请求 rewrite 到
 * `/{locale}/...`。带 locale 前缀的地址只来自语言切换器：记下这个 locale 后跳到不带前缀的地址
 * （docs/adr/0005-unprefixed-urls-in-visitor-locale.md）。
 */
const localeProxy = createMiddleware(routing);

// /demos 及其下的路径，带不带 locale 前缀都算。匹配的是 nextUrl.pathname，它已经去掉了 basePath。
const DEMO_PATH = new RegExp(`^(/(${routing.locales.join("|")}))?/demos(/|$)`);

/** 不提供 Demo 的 build（app/demos.ts）对它们返回 404。 */
export default function proxy(request: NextRequest) {
  if (!DEMOS_SERVED && DEMO_PATH.test(request.nextUrl.pathname))
    return new NextResponse("Not found\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  return localeProxy(request);
}

export const config = {
  // 跳过 Next 内部路径和带扩展名的静态文件。
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
