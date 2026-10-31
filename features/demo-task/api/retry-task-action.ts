"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { ApiError, fetchApi } from "@/lib/fetch";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { TASK_NOT_RETRYABLE } from "../constants/error-codes";
import type { ActionResult } from "../types/action-result";
import { assertMockApiRunning } from "../utils/assert-mock-api-running";
import { type Task, taskSchema } from "./get-task";

const inputSchema = z.object({ taskId: z.string().min(1) });

/** 重试失败的任务。任务已不是 failed（比如在别的标签页重试过）是预期失败。 */
export async function retryTaskAction(
  input: z.input<typeof inputSchema>,
): Promise<ActionResult<Task>> {
  assertMockApiRunning();
  const { taskId } = inputSchema.parse(input);
  try {
    const task = await fetchApi({
      url: `/demo/tasks/${taskId}/retry`,
      method: "POST",
      schema: taskSchema,
      auth: false,
    });
    updateTag(TASK_LIST_TAG);
    return { ok: true, data: task };
  } catch (error) {
    if (error instanceof ApiError && error.code === TASK_NOT_RETRYABLE) {
      return { ok: false, code: error.code };
    }
    throw error;
  }
}
