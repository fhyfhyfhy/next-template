import { mutationOptions } from "@/lib/react-query";

import { TASK_NAME_TAKEN } from "../constants/error-codes";
import {
  isTaskActionError,
  unwrapActionResult,
} from "../utils/task-action-error";
import { createTaskAction } from "./create-task-action";
import type { CreateTaskInput } from "./create-task-request";
import { taskListKey } from "./get-tasks";

/** 创建同时影响两种负责方：action 让列表页的服务端缓存失效，这里刷新浏览器里的列表 query。 */
export const createTaskMutationOptions = () =>
  mutationOptions({
    mutationFn: async (input: CreateTaskInput) =>
      unwrapActionResult(await createTaskAction(input)),
    onSuccess: (_task, _input, _onMutateResult, { client }) => {
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    meta: {
      // 名称被占用由表单在字段上提示，其他失败仍走全局提示。
      suppressErrorToast: (error) => isTaskActionError(error, TASK_NAME_TAKEN),
    },
  });
