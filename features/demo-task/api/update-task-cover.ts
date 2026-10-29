import { fetchApi } from "@/lib/fetch";
import { mutationOptions } from "@/lib/react-query";

import { expireTaskListAction } from "./expire-task-list-action";
import { getTaskQueryOptions, taskSchema } from "./get-task";
import { taskListKey } from "./get-tasks";

interface UpdateTaskCoverVariables {
  taskId: string;
  file: File;
}

// 图片由浏览器直接上传给后端，不经过 Next 服务端转发（Server Action 的请求体默认上限 1MB）。
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
      // 写入没经过 Next 服务端，列表页的服务端缓存要单独失效。
      await expireTaskListAction();
    },
  });
