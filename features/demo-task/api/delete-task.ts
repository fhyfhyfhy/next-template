import { mutationOptions } from "@/lib/react-query";

import { unwrapActionResult } from "../utils/task-action-error";
import { deleteTaskAction } from "./delete-task-action";
import { getCommentsQueryOptions } from "./get-comments";
import { getTaskQueryOptions } from "./get-task";
import { taskListKey } from "./get-tasks";

/** 删除同时影响两种负责方：action 让列表页的服务端缓存失效，这里清理浏览器里的详情、评论和列表 query。 */
export const deleteTaskMutationOptions = () =>
  mutationOptions({
    mutationFn: async (variables: { taskId: string }) =>
      unwrapActionResult(await deleteTaskAction(variables)),
    onSuccess: (_data, { taskId }, _onMutateResult, { client }) => {
      client.removeQueries({ queryKey: getTaskQueryOptions(taskId).queryKey });
      client.removeQueries({
        queryKey: getCommentsQueryOptions(taskId).queryKey,
      });
      void client.invalidateQueries({ queryKey: taskListKey });
    },
  });
