import {
  type InfiniteData,
  mutationOptions,
  type QueryClient,
} from "@/lib/react-query";

import { unwrapActionResult } from "../utils/task-action-error";
import { getTaskQueryOptions, type Task } from "./get-task";
import {
  favoriteTasksQueryOptions,
  taskListKey,
  type TaskPage,
} from "./get-tasks";
import { updateTaskFavoriteAction } from "./update-task-favorite-action";

interface UpdateTaskFavoriteVariables {
  task: Task;
  favorite: boolean;
}

type CachedTaskList = TaskPage | InfiniteData<TaskPage> | Task[];

/**
 * Favoriting: every task list cached in the browser (the Gallery's cards, the
 * "My favorites" sidebar and so on) updates optimistically at once and rolls
 * back together on failure. The Server Action that `mutationFn` calls also
 * expires the list page's server cache. The All tasks page favorites through
 * this too; that page's own star also uses `useOptimistic` (`FavoriteToggle`).
 */
export const updateTaskFavoriteMutationOptions = () =>
  mutationOptions({
    mutationFn: async ({ task, favorite }: UpdateTaskFavoriteVariables) =>
      unwrapActionResult(
        await updateTaskFavoriteAction({ taskId: task.id, favorite }),
      ),
    onMutate: async ({ task, favorite }, { client }) => {
      await client.cancelQueries({ queryKey: taskListKey });
      const previous = client.getQueriesData<CachedTaskList>({
        queryKey: taskListKey,
      });
      const updated = { ...task, favorite };
      setTaskInLists(client, updated);
      client.setQueryData(
        favoriteTasksQueryOptions().queryKey,
        (page) =>
          page && {
            ...page,
            items: favorite
              ? [
                  ...page.items.filter((item) => item.id !== task.id),
                  updated,
                ].sort(newestFirst)
              : page.items.filter((item) => item.id !== task.id),
          },
      );
      return { previous };
    },
    onError: (_error, _variables, onMutateResult, { client }) => {
      for (const [queryKey, data] of onMutateResult?.previous ?? []) {
        client.setQueryData(queryKey, data);
      }
    },
    onSettled: (_data, _error, { task }, _onMutateResult, { client }) => {
      void client.invalidateQueries({ queryKey: taskListKey });
      void client.invalidateQueries({
        queryKey: getTaskQueryOptions(task.id).queryKey,
      });
    },
  });

/**
 * Matches `created_desc` in `favoriteTasksQueryOptions`, so an optimistic
 * insert lands where the refetch will put it.
 */
function newestFirst(a: Task, b: Task) {
  return b.createdAt - a.createdAt;
}

/**
 * Writes the task's new value into every cached task list: paged lists,
 * infinite lists and search results.
 */
function setTaskInLists(client: QueryClient, task: Task) {
  const replace = (items: Task[]) =>
    items.map((item) => (item.id === task.id ? task : item));
  client.setQueriesData<CachedTaskList>({ queryKey: taskListKey }, (data) => {
    if (!data) return data;
    if (Array.isArray(data)) return replace(data);
    if ("pages" in data) {
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: replace(page.items),
        })),
      };
    }
    return { ...data, items: replace(data.items) };
  });
}
