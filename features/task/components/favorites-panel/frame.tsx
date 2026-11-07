"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** 收藏面板的外框和标题，加载中、出错和有数据时都用它，面板大小不跳动。 */
export function FavoritesPanelFrame({ children }: { children: ReactNode }) {
  const t = useTranslations();
  return (
    <section className="self-start rounded-panel border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">
        {t("task.favoritesPanel.title")}
      </h2>
      {children}
    </section>
  );
}
