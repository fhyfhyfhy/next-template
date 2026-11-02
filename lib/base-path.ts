/**
 * The basePath the app is served under; empty serves it at the root. A
 * project that serves it under a path sets it here and nowhere else:
 * next.config.ts reads it, and so does every URL built outside Next's Link,
 * router and redirects, such as the locale switcher's full-page links, since
 * Next adds the basePath only to the URLs it makes itself.
 */
export const BASE_PATH = "";
