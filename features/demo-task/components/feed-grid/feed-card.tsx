"use client";

import { IconStar, IconStarFilled } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Link } from "@/lib/i18n/navigation";
import { useMutation } from "@/lib/react-query";

import type { Task } from "../../api/get-task";
import { updateTaskFavoriteMutationOptions } from "../../api/update-task-favorite";
import { taskDetailHref } from "../../utils/task-urls";
import { TaskCover } from "../task-cover";

/**
 * Favoriting is a React Query optimistic update: the card's star and "My
 * favorites" change together in the factory's onMutate, and roll back together
 * on failure.
 */
export function FeedCard({ task }: { task: Task }) {
  const t = useTranslations("demo-task.feed");
  const favorite = useMutation(updateTaskFavoriteMutationOptions());
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
        <button
          type="button"
          aria-label={t("favorite")}
          aria-pressed={task.favorite}
          className="rounded-control p-1.5 text-muted-foreground hover:bg-accent hover:text-primary aria-pressed:text-primary"
          onClick={() => favorite.mutate({ task, favorite: !task.favorite })}
        >
          {task.favorite ? (
            <IconStarFilled className="size-4" aria-hidden />
          ) : (
            <IconStar className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </article>
  );
}
