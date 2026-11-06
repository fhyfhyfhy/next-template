"use client";

import { useTranslations } from "next-intl";

import { FavoritesPanelFrame } from "./frame";

/** 加载中的收藏面板，也用作服务端预取时的 Suspense fallback。 */
export function FavoritesPanelSkeleton() {
  const t = useTranslations();
  return (
    <FavoritesPanelFrame>
      <p className="text-sm text-muted-foreground">
        {t("demo-task.queryState.loading")}
      </p>
    </FavoritesPanelFrame>
  );
}
