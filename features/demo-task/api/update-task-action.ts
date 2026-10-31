"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { ApiError, fetchApi } from "@/lib/fetch";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { TASK_NAME_TAKEN } from "../constants/error-codes";
import type { ActionResult } from "../types/action-result";
import { assertMockApiRunning } from "../utils/assert-mock-api-running";
import { type Task, taskNameSchema, taskSchema } from "./get-task";

const inputSchema = z.object({
  taskId: z.string().min(1),
  name: taskNameSchema,
});

/** 重命名任务。名称被占用是预期失败，返回 `ok: false`；其他错误照常抛出。 */
export async function updateTaskAction(
  input: z.input<typeof inputSchema>,
): Promise<ActionResult<Task>> {
  assertMockApiRunning();
  const { taskId, name } = inputSchema.parse(input);
  try {
    const task = await fetchApi({
      url: `/demo/tasks/${taskId}`,
      method: "PATCH",
      data: { name },
      schema: taskSchema,
      auth: false,
    });
    updateTag(TASK_LIST_TAG);
    return { ok: true, data: task };
  } catch (error) {
    if (error instanceof ApiError && error.code === TASK_NAME_TAKEN) {
      return { ok: false, code: error.code };
    }
    throw error;
  }
}
