"use client";

import { IconStar, IconStarFilled } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { startTransition, useOptimistic } from "react";

import { useMutation } from "@/lib/react-query";

import type { Task } from "../../api/get-task";
import { updateTaskFavoriteMutationOptions } from "../../api/update-task-favorite";

/**
 * A Server Component owns this row, and the star updates optimistically with
 * `useOptimistic`: a click shows the new state at once, and the Server Action
 * expires the list cache and brings back the refreshed list. On failure the
 * transition ends and it falls back to the server's value. Favorites also show
 * in the Gallery and "My favorites", which React Query owns, so the action is
 * called through the factory's mutation, which syncs those cached copies in the
 * browser.
 */
export function FavoriteToggle({ task }: { task: Task }) {
  const t = useTranslations("demo-task.taskList");
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(
    task.favorite,
  );
  const updateFavorite = useMutation(updateTaskFavoriteMutationOptions());
  return (
    <button
      type="button"
      aria-label={t("favorite")}
      aria-pressed={optimisticFavorite}
      className="rounded-control p-1.5 text-muted-foreground outline-none hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-primary"
      onClick={() => {
        const next = !optimisticFavorite;
        startTransition(async () => {
          setOptimisticFavorite(next);
          try {
            await updateFavorite.mutateAsync({ task, favorite: next });
          } catch {
            // The global error handling shows the failure toast; this only
            // catches the rejection so it doesn't reach the error boundary.
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
