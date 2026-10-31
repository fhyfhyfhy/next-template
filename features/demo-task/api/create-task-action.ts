"use server";

import { updateTag } from "next/cache";

import { ApiError } from "@/lib/fetch";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { TASK_NAME_TAKEN } from "../constants/error-codes";
import type { ActionResult } from "../types/action-result";
import { createTask, type CreateTaskInput } from "./create-task-request";
import type { Task } from "./get-task";

/**
 * 创建任务。名称被占用是预期失败，返回 `ok: false`；其他错误照常抛出。
 * 成功后让列表页的服务端缓存失效，Server Action 的响应会带回刷新后的列表。
 */
export async function createTaskAction(
  input: CreateTaskInput,
): Promise<ActionResult<Task>> {
  try {
    const task = await createTask(input);
    updateTag(TASK_LIST_TAG);
    return { ok: true, data: task };
  } catch (error) {
    if (error instanceof ApiError && error.code === TASK_NAME_TAKEN) {
      return { ok: false, code: error.code, message: "名称已被其他任务占用" };
    }
    throw error;
  }
}
