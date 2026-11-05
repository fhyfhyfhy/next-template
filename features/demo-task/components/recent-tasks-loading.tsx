"use client";

import { useTranslations } from "next-intl";

/** 最近浏览还没读到 `localStorage` 时的状态，也用作页面 Suspense 的 fallback。 */
export function RecentTasksLoading() {
  const t = useTranslations("demo-task");
  return (
    <p className="text-sm text-muted-foreground">{t("recentTasks.reading")}</p>
  );
}
