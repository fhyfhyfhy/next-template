"use client";

import { Link } from "@/lib/i18n-navigation";
import { useQuery } from "@/lib/react-query";

import { favoriteTasksQueryOptions } from "../api/get-tasks";
import { taskDetailHref } from "../utils/task-urls";

/** 和作品广场的卡片显示同一批任务的收藏状态；收藏的乐观更新会同时改这里。 */
export function FavoritesPanel() {
  const favorites = useQuery(favoriteTasksQueryOptions());
  return (
    <section className="self-start rounded-panel border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">我的收藏</h2>
      {favorites.data ? (
        favorites.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有收藏</p>
        ) : (
          <ul aria-label="我的收藏" className="space-y-2 text-sm">
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
        <p className="text-sm text-destructive">加载失败</p>
      ) : (
        <p className="text-sm text-muted-foreground">加载中…</p>
      )}
    </section>
  );
}
