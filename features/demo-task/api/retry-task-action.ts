"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { toActionResult } from "@/lib/action-result";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { TASK_NOT_RETRYABLE } from "../constants/error-codes";
import { assertDemoBackendEnabled } from "../server/connection";
import { retryTask } from "../server/tasks";
import type { Task } from "../types/task";

const inputSchema = z.object({ taskId: z.string().min(1) });

/** 重试失败的任务。任务已不是 failed（比如在别的标签页重试过）是预期失败。 */
export async function retryTaskAction(
  input: z.input<typeof inputSchema>,
): Promise<ActionResult<Task>> {
  assertDemoBackendEnabled();
  const { taskId } = inputSchema.parse(input);
  const result = await toActionResult(
    () => retryTask(taskId),
    [TASK_NOT_RETRYABLE],
  );
  if (result.ok) updateTag(TASK_LIST_TAG);
  return result;
}
