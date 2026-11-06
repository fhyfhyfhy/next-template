"use client";

import { IconStar, IconStarFilled } from "@tabler/icons-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/lib/react-query";

import type { Task } from "../../api/get-task";
import { updateTaskFavoriteMutationOptions } from "../../api/update-task-favorite";
import { taskDetailHref } from "../../utils/task-urls";
import { TaskCover } from "../task-cover";

/** 收藏走 React Query 的乐观更新：卡片的星标和“我的收藏”在工厂的 onMutate 里一起改，失败一起回滚。 */
export function FeedCard({ task }: { task: Task }) {
  const t = useTranslations();
  const favorite = useMutation(updateTaskFavoriteMutationOptions(t));
  return (
    <article className="overflow-hidden rounded-panel border border-border bg-card">
      <TaskCover coverUrl={task.coverUrl} className="aspect-4/3 w-full" />
      <div className="flex items-center gap-2 p-3">
        <Link
          href={taskDetailHref(task.id)}
          className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
        >
          {task.name}
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("demo-task.feed.favorite")}
          aria-pressed={task.favorite}
          className="text-muted-foreground not-data-disabled:hover:text-primary aria-pressed:text-primary"
          onClick={() => favorite.mutate({ task, favorite: !task.favorite })}
        >
          {task.favorite ? (
            <IconStarFilled aria-hidden />
          ) : (
            <IconStar aria-hidden />
          )}
        </Button>
      </div>
    </article>
  );
}
