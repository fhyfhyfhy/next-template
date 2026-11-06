import { isActionError, unwrapActionResult } from "@/lib/action-result";
import type { Translator } from "@/lib/i18n/translator";
import { mutationOptions } from "@/lib/react-query";

import { TASK_NOT_RETRYABLE } from "../constants/error-codes";
import {
  insertTaskIntoPage,
  restoreTaskLists,
  setTaskInLists,
  snapshotTaskLists,
} from "../utils/task-list-cache";
import { getTaskQueryOptions, type Task } from "./get-task";
import { activeTasksQueryOptions, taskListKey } from "./get-tasks";
import { retryTaskAction } from "./retry-task-action";

/** 重试后的任务：服务端重试时改的字段（server/tasks.ts 的 `retryTask`），`updated_at` 由服务端决定，等 refetch。 */
const asRetried = (task: Task): Task => ({
  ...task,
  status: "pending",
  progress: 0,
});

/** 一个任务的重试 mutation 的 key，详情页据此判断重试是否还在等服务端确认。 */
export const retryTaskMutationKey = (taskId: string) =>
  ["task", "task", "retry", taskId] as const;

/**
 * 重试失败的任务：详情和每份缓存列表先乐观改成 pending，任务按列表顺序插进进行中的任务，失败时回滚。
 * `taskId` 对这个 mutation 固定不变，所以是工厂参数。
 */
export const retryTaskMutationOptions = (t: Translator, taskId: string) => {
  const { queryKey } = getTaskQueryOptions(taskId);
  return mutationOptions({
    mutationKey: retryTaskMutationKey(taskId),
    mutationFn: async () =>
      unwrapActionResult(await retryTaskAction({ taskId })),
    onMutate: async (_variables, { client }) => {
      await client.cancelQueries({ queryKey });
      const lists = await snapshotTaskLists(client, taskListKey);
      const previous = client.getQueryData(queryKey);
      // 写成 pending 后，详情 query 的 refetchInterval 重新开始轮询。
      client.setQueryData(queryKey, (task) => task && asRetried(task));
      setTaskInLists(client, taskListKey, taskId, asRetried);
      // 插入要用整条任务，取自详情；没有详情缓存时只等 onSettled 的 refetch。
      if (previous) {
        client.setQueryData(
          activeTasksQueryOptions().queryKey,
          (page) => page && insertTaskIntoPage(page, asRetried(previous)),
        );
      }
      return { previous, lists };
    },
    onError: (_error, _variables, onMutateResult, { client }) => {
      client.setQueryData(queryKey, onMutateResult?.previous);
      restoreTaskLists(client, onMutateResult?.lists);
    },
    // 失败时也要 refetch：`TASK_NOT_RETRYABLE` 说明任务状态已在别处变化，回滚后的详情不是最新状态。
    onSettled: (_data, _error, _variables, _onMutateResult, { client }) => {
      void client.invalidateQueries({ queryKey });
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    meta: {
      errorMessage: t("task.taskActions.retryFailed"),
      suppressErrorToast: (error) => isActionError(error, TASK_NOT_RETRYABLE),
    },
  });
};
