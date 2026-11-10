import {
  createUploadAction,
  UPLOAD_ALREADY_USED,
  UPLOAD_NOT_READY,
  uploadFile,
} from "@/features/upload";
import type { Translator } from "@/lib/i18n/translator";
import { mutationOptions } from "@/lib/react-query";
import { isActionError, unwrapActionResult } from "@/lib/request/action-result";

import { getTaskQueryOptions } from "./get-task";
import { taskListKey } from "./get-tasks";
import { updateTaskCoverAction } from "./update-task-cover-action";

interface UpdateTaskCoverVariables {
  taskId: string;
  file: File;
}

/**
 * 更换封面分三步：签发上传（upload 的 Server Action）、浏览器把文件直传对象存储、再由 Server Action 让任务
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

export const updateTaskCoverMutationOptions = (t: Translator) =>
  mutationOptions({
    mutationFn: updateTaskCover,
    onSuccess: (task, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getTaskQueryOptions(task.id).queryKey, task);
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    meta: {
      errorMessage: t("task.taskCover.changeFailed"),
      // 关联时的预期失败由封面面板就地提示（TaskCoverPanel），其他失败仍走全局提示。
      suppressErrorToast: isCoverRejection,
    },
  });

/** 关联封面时数据层按业务规则拒绝：这次上传已被别的记录使用，或文件没有按声明传完。 */
export function isCoverRejection(error: unknown) {
  return (
    isActionError(error, UPLOAD_ALREADY_USED) ||
    isActionError(error, UPLOAD_NOT_READY)
  );
}
