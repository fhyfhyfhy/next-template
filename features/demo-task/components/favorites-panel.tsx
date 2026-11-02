"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/lib/i18n/navigation";
import { useQuery } from "@/lib/react-query";

import { favoriteTasksQueryOptions } from "../api/get-tasks";
import { taskDetailHref } from "../utils/task-urls";

/** 和作品广场的卡片显示同一批任务的收藏状态；收藏的乐观更新会同时改这里。 */
export function FavoritesPanel() {
  const t = useTranslations("demo-task");
  const favorites = useQuery(favoriteTasksQueryOptions());
  return (
    <section className="self-start rounded-panel border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">{t("favoritesPanel.title")}</h2>
      {favorites.data ? (
        favorites.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("favoritesPanel.empty")}
          </p>
        ) : (
          <ul
            aria-label={t("favoritesPanel.title")}
            className="space-y-2 text-sm"
          >
            {favorites.data.items.map((task) => (
              <li key={task.id}>
                <Link
                  href={taskDetailHref(task.id)}
                  className="hover:text-primary"
                >
                  {task.name}
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : favorites.error ? (
        <p className="text-sm text-destructive">{t("queryState.loadFailed")}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("queryState.loading")}
        </p>
      )}
    </section>
  );
}
