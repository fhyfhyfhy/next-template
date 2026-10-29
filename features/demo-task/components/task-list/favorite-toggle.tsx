"use client";

import { IconStar, IconStarFilled } from "@tabler/icons-react";
import { startTransition, useOptimistic } from "react";

import { toast } from "@/components/ui/toaster";

import { updateTaskFavoriteAction } from "../../api/update-task-favorite-action";

interface FavoriteToggleProps {
  taskId: string;
  favorite: boolean;
}

/**
 * Server Component 负责的数据用 `useOptimistic` 做乐观更新：点击后立即显示新状态，
 * Server Action 让列表缓存失效并带回刷新后的列表；失败时 transition 结束，自动回到服务端给的值。
 */
export function FavoriteToggle({ taskId, favorite }: FavoriteToggleProps) {
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(favorite);
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
            await updateTaskFavoriteAction({ taskId, favorite: next });
          } catch {
            // 不是 React Query 的请求，不经过全局错误处理；用 feature 自己的提示，不占用全局请求错误的 toast ID。
            toast.error("收藏失败，请稍后重试");
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
