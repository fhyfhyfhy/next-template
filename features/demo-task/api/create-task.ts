import type { Locale } from "@/lib/i18n/routing";
import { mutationOptions } from "@/lib/react-query";

import { TASK_NAME_TAKEN } from "../constants/error-codes";
import {
  isTaskActionError,
  unwrapActionResult,
} from "../utils/task-action-error";
import { createTaskAction } from "./create-task-action";
import type { CreateTaskInput } from "./create-task-request";
import { taskListKey } from "./get-tasks";

/**
 * Creating touches both owners: the action expires the list page's server
 * cache, and this refreshes the list queries in the browser. `locale` is passed
 * on to the action.
 */
export const createTaskMutationOptions = (locale: Locale) =>
  mutationOptions({
    mutationFn: async (input: CreateTaskInput) =>
      unwrapActionResult(await createTaskAction(locale, input)),
    onSuccess: (_task, _input, _onMutateResult, { client }) => {
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    meta: {
      // The form shows a taken name on its field; other failures still get the
      // global toast.
      suppressErrorToast: (error) => isTaskActionError(error, TASK_NAME_TAKEN),
    },
  });
