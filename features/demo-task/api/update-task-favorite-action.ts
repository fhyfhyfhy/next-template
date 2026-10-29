"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { fetchApi } from "@/lib/fetch";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import type { ActionResult } from "../types/action-result";
import { type Task, taskSchema } from "./get-task";

const inputSchema = z.object({
  taskId: z.string().min(1),
  favorite: z.boolean(),
});

/** 设置收藏，并让列表页的服务端缓存失效。收藏没有预期的业务失败，出错时照常抛出。 */
export async function updateTaskFavoriteAction(
  input: z.input<typeof inputSchema>,
): Promise<ActionResult<Task>> {
  const { taskId, favorite } = inputSchema.parse(input);
  const task = await fetchApi({
    url: `/demo/tasks/${taskId}/favorite`,
    method: "PUT",
    data: { favorite },
    schema: taskSchema,
    auth: false,
  });
  updateTag(TASK_LIST_TAG);
  return { ok: true, data: task };
}
