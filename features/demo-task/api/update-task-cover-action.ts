"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { UPLOAD_ALREADY_USED, UPLOAD_NOT_READY } from "@/features/demo-upload";
import type { ActionResult } from "@/lib/action-result";
import { toActionResult } from "@/lib/action-result";
import { assertDemoBackendEnabled } from "@/lib/demo-backend";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { setTaskCover } from "../server/tasks";
import type { Task } from "../types/task";

const inputSchema = z.object({
  taskId: z.string().min(1),
  uploadId: z.string().min(1),
});

/**
 * 上传的第三步：让任务用已经传到对象存储的文件作为封面，并让列表页的服务端缓存失效。数据层先核对文件确实
 * 按声明传完了；重复提交同一次上传不报错。这次上传已被别的记录使用、或文件和声明不一致是预期失败，返回业务码，
 * 由封面面板就地提示；其他失败照常抛出，走全局提示。
 */
export async function updateTaskCoverAction(
  input: z.input<typeof inputSchema>,
): Promise<ActionResult<Task>> {
  assertDemoBackendEnabled();
  const { taskId, uploadId } = inputSchema.parse(input);
  const result = await toActionResult(
    () => setTaskCover(taskId, { uploadId }),
    [UPLOAD_ALREADY_USED, UPLOAD_NOT_READY],
  );
  if (result.ok) updateTag(TASK_LIST_TAG);
  return result;
}
