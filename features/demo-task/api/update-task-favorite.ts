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
 * 收藏：浏览器里缓存的每份任务列表（作品广场的卡片、“我的收藏”侧栏等）同时乐观更新，失败时一起回滚。
 * `mutationFn` 调用的 Server Action 同时让列表页的服务端缓存失效。全部任务页的收藏也走它，
 * 那一页自己的星标另用 `useOptimistic`（`FavoriteToggle`）。
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
              ? [updated, ...page.items.filter((item) => item.id !== task.id)]
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

/** 把任务的新值写进每一个缓存里的任务列表：分页列表、无限列表和搜索结果。 */
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
