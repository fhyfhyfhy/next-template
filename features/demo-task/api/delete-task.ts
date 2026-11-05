import { mutationOptions } from "@/lib/react-query";

import type { DemoTaskTranslator } from "../types/translator";
import {
  removeTaskFromLists,
  restoreTaskLists,
  snapshotTaskLists,
} from "../utils/task-list-cache";
import { deleteTaskAction } from "./delete-task-action";
import { getCommentsQueryOptions } from "./get-comments";
import { getTaskQueryOptions } from "./get-task";
import { taskListKey } from "./get-tasks";

/**
 * 删除同时影响两种负责方：action 让列表页的服务端缓存失效，这里处理浏览器里的 query。任务先从每份缓存列表里乐观移除，
 * header 徽标读的进行中任务数随之减一，失败时回滚。详情和评论等成功后再清掉：调用方成功后才离开详情页，
 * 提前清掉会让还显示着的详情重新请求。
 */
export const deleteTaskMutationOptions = (t: DemoTaskTranslator) =>
  mutationOptions({
    mutationFn: deleteTaskAction,
    onMutate: async ({ taskId }, { client }) => {
      const previous = await snapshotTaskLists(client, taskListKey);
      removeTaskFromLists(client, taskListKey, taskId);
      return { previous };
    },
    onError: (_error, _variables, onMutateResult, { client }) => {
      restoreTaskLists(client, onMutateResult?.previous);
    },
    onSuccess: (_data, { taskId }, _onMutateResult, { client }) => {
      client.removeQueries({ queryKey: getTaskQueryOptions(taskId).queryKey });
      client.removeQueries({
        queryKey: getCommentsQueryOptions(taskId).queryKey,
      });
    },
    // 不等 refetch：调用方在 mutate 的 onSuccess 里离开详情页，它在工厂的回调全部结束后才运行。
    onSettled: (_data, _error, _variables, _onMutateResult, { client }) => {
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    meta: { errorMessage: t("deleteTask.failed") },
  });
