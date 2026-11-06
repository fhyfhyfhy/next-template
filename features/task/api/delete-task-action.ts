"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { DomainError } from "@/lib/domain-error";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { deleteTask } from "../server/tasks";

const inputSchema = z.object({ taskId: z.string().min(1) });

/** 删除任务及其评论。任务已经不存在时按删除成功处理，重复删除不报错。 */
export async function deleteTaskAction(
  input: z.input<typeof inputSchema>,
): Promise<void> {
  const { taskId } = inputSchema.parse(input);
  try {
    await deleteTask(taskId);
  } catch (error) {
    if (!(error instanceof DomainError && error.status === 404)) throw error;
  }
  updateTag(TASK_LIST_TAG);
}
