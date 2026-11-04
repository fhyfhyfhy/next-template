import { isActionError, unwrapActionResult } from "@/lib/action-result";
import { mutationOptions } from "@/lib/react-query";

import { TASK_NOT_RETRYABLE } from "../constants/error-codes";
import type { DemoTaskTranslator } from "../types/translator";
import { getTaskQueryOptions } from "./get-task";
import { taskListKey } from "./get-tasks";
import { retryTaskAction } from "./retry-task-action";

export const retryTaskMutationOptions = (t: DemoTaskTranslator) =>
  mutationOptions({
    mutationFn: async (variables: { taskId: string }) =>
      unwrapActionResult(await retryTaskAction(variables)),
    onSuccess: (task, _variables, _onMutateResult, { client }) => {
      // 写回 pending 状态后，详情 query 的 refetchInterval 重新开始轮询。
      client.setQueryData(getTaskQueryOptions(task.id).queryKey, task);
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    onError: (error, { taskId }, _onMutateResult, { client }) => {
      // 任务状态已在别处变化，刷新详情让页面显示最新状态。
      if (isActionError(error, TASK_NOT_RETRYABLE)) {
        void client.invalidateQueries({
          queryKey: getTaskQueryOptions(taskId).queryKey,
        });
      }
    },
    meta: {
      errorMessage: t("taskActions.retryFailed"),
      suppressErrorToast: (error) => isActionError(error, TASK_NOT_RETRYABLE),
    },
  });
