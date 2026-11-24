import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("app.globalNotFound.title") };
}

/**
 * 没有别的路由匹配的页面路径，比如打错的地址或旧书签。proxy.ts 已经按访客的语言把它交给 `[locale]`，所以这里的
 * 404（app/[locale]/not-found.tsx）用访客的语言显示；app/global-not-found.tsx 只剩进不了 `[locale]` 的请求。
 */
export default function UnmatchedPage(): never {
  notFound();
}
