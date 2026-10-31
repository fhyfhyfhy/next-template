import { createNavigation } from "next-intl/navigation";

import { routing } from "./i18n-routing";

/**
 * 带 locale 的导航 API：href 写不带 locale 的路径（`/demos/tasks`），按当前 locale 补前缀。
 * `next/link` 和 `next/navigation` 的同名 API 会丢掉非默认 locale 的前缀，ESLint 禁止直接使用。
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
