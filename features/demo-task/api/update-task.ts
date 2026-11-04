import { isActionError, unwrapActionResult } from "@/lib/action-result";
import type { Locale } from "@/lib/i18n/routing";
import { mutationOptions } from "@/lib/react-query";

import { TASK_NAME_TAKEN } from "../constants/error-codes";
import type { DemoTaskTranslator } from "../types/translator";
import { getTaskQueryOptions } from "./get-task";
import { taskListKey } from "./get-tasks";
import { updateTaskAction } from "./update-task-action";

/** 重命名同时影响详情（React Query）和列表页（服务端缓存）：action 让列表缓存失效，这里更新 query。`locale` 转交给 action。 */
export const updateTaskMutationOptions = (
  t: DemoTaskTranslator,
  locale: Locale,
) =>
  mutationOptions({
    mutationFn: async (variables: { taskId: string; name: string }) =>
      unwrapActionResult(await updateTaskAction(locale, variables)),
    onSuccess: (task, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getTaskQueryOptions(task.id).queryKey, task);
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    meta: {
      errorMessage: t("renameTask.failed"),
      // 名称被占用由表单在字段上提示，其他失败仍走全局提示。
      suppressErrorToast: (error) => isActionError(error, TASK_NAME_TAKEN),
    },
  });
