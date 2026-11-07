"use server";

import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import type { ActionResult } from "@/lib/action-result";
import { toActionResult } from "@/lib/action-result";
import type { Locale } from "@/lib/i18n/routing";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { TASK_NAME_TAKEN } from "../constants/error-codes";
import { createTask } from "../server/tasks";
import type { Task } from "../types/task";
import {
  type CreateTaskInput,
  createTaskInputSchema,
} from "./create-task-schema";

/**
 * 创建任务。名称被占用是预期失败，返回 `ok: false`；其他错误照常抛出。
 * 成功后让列表页的服务端缓存失效，Server Action 的响应会带回刷新后的列表。
 * Server Action 读不到 `[locale]`，`locale` 由调用方传入，用来生成校验文案。
 */
export async function createTaskAction(
  locale: Locale,
  input: CreateTaskInput,
): Promise<ActionResult<Task>> {
  const t = await getTranslations({ locale });
  const data = createTaskInputSchema(t).parse(input);
  const result = await toActionResult(
    () => createTask(data),
    [TASK_NAME_TAKEN],
  );
  if (result.ok) updateTag(TASK_LIST_TAG);
  return result;
}
