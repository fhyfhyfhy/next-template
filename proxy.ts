import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { DEMOS_SERVED } from "@/lib/demos";
import { routing } from "@/lib/i18n/routing";

/**
 * Takes the locale from the URL's prefix, then the `NEXT_LOCALE` cookie, then
 * `Accept-Language`: a default-locale request is rewritten to `/{locale}/...`,
 * and one for another locale without its prefix is redirected to add it
 * (docs/adr/0002-locale-routing-as-needed-prefix.md).
 */
const localeProxy = createMiddleware(routing);

// /demos and the paths under it, with or without a locale prefix. Matched
// against nextUrl.pathname, which has the basePath taken off.
const DEMO_PATH = new RegExp(`^(/(${routing.locales.join("|")}))?/demos(/|$)`);

/** A build that serves no demos (lib/demos.ts) answers 404 for them. */
export default function proxy(request: NextRequest) {
  if (!DEMOS_SERVED && DEMO_PATH.test(request.nextUrl.pathname))
    return new NextResponse("Not found\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  return localeProxy(request);
}

export const config = {
  // Skips Next's internal paths and static files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
