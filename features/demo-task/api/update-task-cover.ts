import { uploadFile } from "@/features/demo-upload";
import { createUploadAction } from "@/features/demo-upload/actions";
import { mutationOptions } from "@/lib/react-query";

import { unwrapActionResult } from "../utils/task-action-error";
import { getTaskQueryOptions } from "./get-task";
import { taskListKey } from "./get-tasks";
import { updateTaskCoverAction } from "./update-task-cover-action";

interface UpdateTaskCoverVariables {
  taskId: string;
  file: File;
}

/**
 * 更换封面分三步：签发上传（demo-upload 的 Server Action）、浏览器把文件直传对象存储、再由 Server Action 让任务
 * 使用这次上传。文件不经过 Next 服务端，不受 Server Action 请求体的大小限制。
 */
const updateTaskCover = async ({ taskId, file }: UpdateTaskCoverVariables) => {
  const { id, uploadUrl } = await createUploadAction({
    purpose: "task-cover",
    contentType: file.type,
    size: file.size,
  });
  await uploadFile(uploadUrl, file);
  return unwrapActionResult(
    await updateTaskCoverAction({ taskId, uploadId: id }),
  );
};

export const updateTaskCoverMutationOptions = () =>
  mutationOptions({
    mutationFn: updateTaskCover,
    onSuccess: (task, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getTaskQueryOptions(task.id).queryKey, task);
      void client.invalidateQueries({ queryKey: taskListKey });
    },
  });
