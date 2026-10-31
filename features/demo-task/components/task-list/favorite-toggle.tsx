"use client";

import { IconStar, IconStarFilled } from "@tabler/icons-react";
import { startTransition, useOptimistic } from "react";

import { useMutation } from "@/lib/react-query";

import type { Task } from "../../api/get-task";
import { updateTaskFavoriteMutationOptions } from "../../api/update-task-favorite";

/**
 * 这一行由 Server Component 负责，星标用 `useOptimistic` 做乐观更新：点击后立即显示新状态，
 * Server Action 让列表缓存失效并带回刷新后的列表；失败时 transition 结束，自动回到服务端给的值。
 * 收藏也显示在 React Query 负责的作品广场和“我的收藏”里，所以经工厂的 mutation 调用 action，
 * 由工厂同步浏览器里缓存的那些副本。
 */
export function FavoriteToggle({ task }: { task: Task }) {
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(
    task.favorite,
  );
  const updateFavorite = useMutation(updateTaskFavoriteMutationOptions());
  return (
    <button
      type="button"
      aria-label="收藏"
      aria-pressed={optimisticFavorite}
      className="rounded-control p-1.5 text-muted-foreground outline-none hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-primary"
      onClick={() => {
        const next = !optimisticFavorite;
        startTransition(async () => {
          setOptimisticFavorite(next);
          try {
            await updateFavorite.mutateAsync({ task, favorite: next });
          } catch {
            // 失败提示由全局错误处理弹出；这里只接住 rejection，免得它冒到错误边界。
          }
        });
      }}
    >
      {optimisticFavorite ? (
        <IconStarFilled className="size-4" aria-hidden />
      ) : (
        <IconStar className="size-4" aria-hidden />
      )}
    </button>
  );
}
