import { mutationOptions } from "@/lib/react-query";

import { unwrapActionResult } from "../utils/task-action-error";
import { deleteTaskAction } from "./delete-task-action";
import { getCommentsQueryOptions } from "./get-comments";
import { getTaskQueryOptions } from "./get-task";
import { taskListKey } from "./get-tasks";

/**
 * Deleting touches both owners: the action expires the list page's server
 * cache, and this clears the detail, comments and list queries in the browser.
 */
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
