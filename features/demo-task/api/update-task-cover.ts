import { fetchApi } from "@/lib/fetch";
import { mutationOptions } from "@/lib/react-query";

import { expireTaskListAction } from "./expire-task-list-action";
import { getTaskQueryOptions, taskSchema } from "./get-task";
import { taskListKey } from "./get-tasks";

interface UpdateTaskCoverVariables {
  taskId: string;
  file: File;
}

// The browser uploads the image straight to the backend rather than through the
// Next server (a Server Action's request body is capped at 1MB by default).
const updateTaskCover = ({ taskId, file }: UpdateTaskCoverVariables) => {
  const data = new FormData();
  data.append("file", file);
  return fetchApi({
    url: `/demo/tasks/${taskId}/cover`,
    method: "PUT",
    data,
    schema: taskSchema,
    auth: false,
  });
};

export const updateTaskCoverMutationOptions = () =>
  mutationOptions({
    mutationFn: updateTaskCover,
    onSuccess: async (task, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getTaskQueryOptions(task.id).queryKey, task);
      void client.invalidateQueries({ queryKey: taskListKey });
      // The write bypassed the Next server, so the list page's server cache has
      // to be expired separately.
      await expireTaskListAction();
    },
  });
