"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { ApiError, fetchApi } from "@/lib/fetch";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import type { ActionResult } from "../types/action-result";
import { assertMockApiRunning } from "../utils/assert-mock-api-running";

const inputSchema = z.object({ taskId: z.string().min(1) });

/** 删除任务及其评论。任务已经不存在时按删除成功处理，重复删除不报错。 */
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
