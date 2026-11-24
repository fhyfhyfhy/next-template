"use client";

import { useTranslations } from "next-intl";

import { useQuery } from "@/lib/react-query";

import { favoriteTasksQueryOptions } from "../../api/get-tasks";
import { isQueryLoadFailed } from "../../utils/query-load-state";
import { QueryLoadFailed } from "../query-load-failed";
import { TaskNameLink } from "../task-name-link";
import { FavoritesPanelFrame } from "./frame";
import { FavoritesPanelSkeleton } from "./skeleton";

export { FavoritesPanelSkeleton } from "./skeleton";

/** 和作品广场的卡片显示同一批任务的收藏状态；收藏的乐观更新会同时改这里。 */
export function FavoritesPanel() {
  const t = useTranslations();
  const favorites = useQuery(favoriteTasksQueryOptions());
  if (!favorites.data) {
    return isQueryLoadFailed(favorites) ? (
      <FavoritesPanelFrame>
        <QueryLoadFailed
          query={favorites}
          retryLabel={t("task.favoritesPanel.retryLabel")}
        />
      </FavoritesPanelFrame>
    ) : (
      <FavoritesPanelSkeleton />
    );
  }
  return (
    <FavoritesPanelFrame>
      {favorites.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("task.favoritesPanel.empty")}
        </p>
      ) : (
        <ul
          aria-label={t("task.favoritesPanel.title")}
          className="space-y-2 text-sm"
        >
          {favorites.data.items.map((task) => (
            <li key={task.id}>
              <TaskNameLink task={task} />
            </li>
          ))}
        </ul>
      )}
    </FavoritesPanelFrame>
  );
}
