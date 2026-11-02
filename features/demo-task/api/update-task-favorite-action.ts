"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { assertDemoBackendEnabled } from "../server/connection";
import { setTaskFavorite } from "../server/tasks";
import type { Task } from "../types/task";

const inputSchema = z.object({
  taskId: z.string().min(1),
  favorite: z.boolean(),
});

/** 设置收藏，并让列表页的服务端缓存失效。收藏没有预期的业务失败，出错时照常抛出。 */
export async function updateTaskFavoriteAction(
  input: z.input<typeof inputSchema>,
): Promise<Task> {
  assertDemoBackendEnabled();
  const { taskId, favorite } = inputSchema.parse(input);
  const task = await setTaskFavorite(taskId, { favorite });
  updateTag(TASK_LIST_TAG);
  return task;
}
