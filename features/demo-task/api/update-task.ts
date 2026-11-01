import type { Locale } from "@/lib/i18n/routing";
import { mutationOptions } from "@/lib/react-query";

import { TASK_NAME_TAKEN } from "../constants/error-codes";
import {
  isTaskActionError,
  unwrapActionResult,
} from "../utils/task-action-error";
import { getTaskQueryOptions } from "./get-task";
import { taskListKey } from "./get-tasks";
import { updateTaskAction } from "./update-task-action";

/**
 * Renaming touches both the detail (React Query) and the list page (server
 * cache): the action expires the list cache, and this updates the query.
 * `locale` is passed on to the action.
 */
export const updateTaskMutationOptions = (locale: Locale) =>
  mutationOptions({
    mutationFn: async (variables: { taskId: string; name: string }) =>
      unwrapActionResult(await updateTaskAction(locale, variables)),
    onSuccess: (task, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getTaskQueryOptions(task.id).queryKey, task);
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    meta: {
      // The form shows a taken name on its field; other failures still get the
      // global toast.
      suppressErrorToast: (error) => isTaskActionError(error, TASK_NAME_TAKEN),
    },
  });
