import type { Locale } from "@/lib/i18n-routing";
import { mutationOptions } from "@/lib/react-query";

import { TASK_NAME_TAKEN } from "../constants/error-codes";
import {
  isTaskActionError,
  unwrapActionResult,
} from "../utils/task-action-error";
import { getTaskQueryOptions } from "./get-task";
import { taskListKey } from "./get-tasks";
import { updateTaskAction } from "./update-task-action";

/** 重命名同时影响详情（React Query）和列表页（服务端缓存）：action 让列表缓存失效，这里更新 query。`locale` 转交给 action。 */
export const updateTaskMutationOptions = (locale: Locale) =>
  mutationOptions({
    mutationFn: async (variables: { taskId: string; name: string }) =>
      unwrapActionResult(await updateTaskAction(locale, variables)),
    onSuccess: (task, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getTaskQueryOptions(task.id).queryKey, task);
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    meta: {
      // 名称被占用由表单在字段上提示，其他失败仍走全局提示。
      suppressErrorToast: (error) => isTaskActionError(error, TASK_NAME_TAKEN),
    },
  });
