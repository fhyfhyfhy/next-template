import { mutationOptions } from "@/lib/react-query";

import type { DemoTaskTranslator } from "../types/translator";
import {
  insertTaskIntoPage,
  removeTaskFromPage,
  restoreTaskLists,
  setTaskInLists,
  snapshotTaskLists,
} from "../utils/task-list-cache";
import { getTaskQueryOptions, type Task } from "./get-task";
import { favoriteTasksQueryOptions, taskListKey } from "./get-tasks";
import { updateTaskFavoriteAction } from "./update-task-favorite-action";

interface UpdateTaskFavoriteVariables {
  task: Task;
  favorite: boolean;
}

/**
 * 收藏：浏览器里缓存的每份任务列表（作品广场的卡片、“我的收藏”侧栏等）同时乐观更新，失败时一起回滚。
 * `mutationFn` 调用的 Server Action 同时让列表页的服务端缓存失效。全部任务页的收藏也走它，
 * 那一页自己的星标另用 `useOptimistic`（`FavoriteToggle`）。
 */
export const updateTaskFavoriteMutationOptions = (t: DemoTaskTranslator) =>
  mutationOptions({
    mutationFn: ({ task, favorite }: UpdateTaskFavoriteVariables) =>
      updateTaskFavoriteAction({ taskId: task.id, favorite }),
    onMutate: async ({ task, favorite }, { client }) => {
      const previous = await snapshotTaskLists(client, taskListKey);
      setTaskInLists(client, taskListKey, task.id, (item) => ({
        ...item,
        favorite,
      }));
      // 只有插进“我的收藏”时用调用方的整条任务：这份列表里原本没有它。
      client.setQueryData(
        favoriteTasksQueryOptions().queryKey,
        (page) =>
          page &&
          (favorite
            ? insertTaskIntoPage(page, { ...task, favorite })
            : removeTaskFromPage(page, task.id)),
      );
      return { previous };
    },
    onError: (_error, _variables, onMutateResult, { client }) => {
      restoreTaskLists(client, onMutateResult?.previous);
    },
    onSettled: (_data, _error, { task }, _onMutateResult, { client }) => {
      void client.invalidateQueries({ queryKey: taskListKey });
      void client.invalidateQueries({
        queryKey: getTaskQueryOptions(task.id).queryKey,
      });
    },
    meta: { errorMessage: t("favorite.failed") },
  });
