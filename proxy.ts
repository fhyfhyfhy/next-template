import createMiddleware from "next-intl/middleware";

import { routing } from "@/lib/i18n/routing";

/**
 * Takes the locale from the URL's prefix, then the `NEXT_LOCALE` cookie, then
 * `Accept-Language`: a default-locale request is rewritten to `/{locale}/...`,
 * and one for another locale without its prefix is redirected to add it
 * (docs/adr/0002-locale-routing-as-needed-prefix.md).
 */
export default createMiddleware(routing);

export const config = {
  // Skips Next's internal paths and static files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
