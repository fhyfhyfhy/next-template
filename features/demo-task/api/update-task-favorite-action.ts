"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { fetchApi } from "@/lib/fetch";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import type { ActionResult } from "../types/action-result";
import { assertMockApiRunning } from "../utils/assert-mock-api-running";
import { type Task, taskSchema } from "./get-task";

const inputSchema = z.object({
  taskId: z.string().min(1),
  favorite: z.boolean(),
});

/**
 * Sets the favorite and expires the list page's server cache. Favoriting has no
 * expected business failure, so errors are thrown as usual.
 */
export async function updateTaskFavoriteAction(
  input: z.input<typeof inputSchema>,
): Promise<ActionResult<Task>> {
  assertMockApiRunning();
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
