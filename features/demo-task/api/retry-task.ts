import { mutationOptions } from "@/lib/react-query";

import { TASK_NOT_RETRYABLE } from "../constants/error-codes";
import {
  isTaskActionError,
  unwrapActionResult,
} from "../utils/task-action-error";
import { getTaskQueryOptions } from "./get-task";
import { taskListKey } from "./get-tasks";
import { retryTaskAction } from "./retry-task-action";

export const retryTaskMutationOptions = () =>
  mutationOptions({
    mutationFn: async (variables: { taskId: string }) =>
      unwrapActionResult(await retryTaskAction(variables)),
    onSuccess: (task, _variables, _onMutateResult, { client }) => {
      // With pending written back, the detail query's refetchInterval starts
      // polling again.
      client.setQueryData(getTaskQueryOptions(task.id).queryKey, task);
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    onError: (error, { taskId }, _onMutateResult, { client }) => {
      // The task's status changed elsewhere; refresh the detail so the page
      // shows the latest.
      if (isTaskActionError(error, TASK_NOT_RETRYABLE)) {
        void client.invalidateQueries({
          queryKey: getTaskQueryOptions(taskId).queryKey,
        });
      }
    },
    meta: {
      suppressErrorToast: (error) =>
        isTaskActionError(error, TASK_NOT_RETRYABLE),
    },
  });
