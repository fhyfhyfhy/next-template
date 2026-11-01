import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware navigation APIs: an href is a path without the locale (`/demos/tasks`), and they add
 * the current locale's prefix. The APIs of the same names in `next/link` and `next/navigation` drop
 * the prefix of a non-default locale, so ESLint forbids using them directly.
 */
export const {
  Link,
  redirect,
  permanentRedirect,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation(routing);
