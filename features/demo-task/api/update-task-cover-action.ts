"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { assertDemoBackendEnabled } from "../server/connection";
import { setTaskCover } from "../server/tasks";
import type { ActionResult } from "../types/action-result";
import type { Task } from "../types/task";

const inputSchema = z.object({
  taskId: z.string().min(1),
  uploadId: z.string().min(1),
});

/**
 * 上传的第三步：让任务用已经传到对象存储的文件作为封面，并让列表页的服务端缓存失效。数据层先核对文件确实
 * 按声明传完了；重复提交同一次上传不报错。失败都照常抛出，走全局提示。
 */
export async function updateTaskCoverAction(
  input: z.input<typeof inputSchema>,
): Promise<ActionResult<Task>> {
  assertDemoBackendEnabled();
  const { taskId, uploadId } = inputSchema.parse(input);
  const task = await setTaskCover(taskId, { uploadId });
  updateTag(TASK_LIST_TAG);
  return { ok: true, data: task };
}
