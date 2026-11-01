"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { ApiError, fetchApi } from "@/lib/fetch";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import type { ActionResult } from "../types/action-result";
import { assertMockApiRunning } from "../utils/assert-mock-api-running";

const inputSchema = z.object({ taskId: z.string().min(1) });

/**
 * Deletes a task and its comments. A task that no longer exists counts as
 * deleted, so deleting twice is not an error.
 */
export async function deleteTaskAction(
  input: z.input<typeof inputSchema>,
): Promise<ActionResult<null>> {
  assertMockApiRunning();
  const { taskId } = inputSchema.parse(input);
  try {
    await fetchApi({
      url: `/demo/tasks/${taskId}`,
      method: "DELETE",
      schema: z.null(),
      auth: false,
    });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
  updateTag(TASK_LIST_TAG);
  return { ok: true, data: null };
}
