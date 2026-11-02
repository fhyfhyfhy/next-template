"use server";

import { updateTag } from "next/cache";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { ApiError } from "@/lib/fetch";
import { type Locale, routing } from "@/lib/i18n/routing";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { TASK_NAME_TAKEN } from "../constants/error-codes";
import type { ActionResult } from "../types/action-result";
import { assertMockApiRunning } from "../utils/assert-mock-api-running";
import {
  createTask,
  type CreateTaskInput,
  createTaskInputSchema,
} from "./create-task-request";
import type { Task } from "./get-task";

/**
 * 创建任务。名称被占用是预期失败，返回 `ok: false`；其他错误照常抛出。
 * 成功后让列表页的服务端缓存失效，Server Action 的响应会带回刷新后的列表。
 * Server Action 读不到 `[locale]`，`locale` 由调用方传入，用来生成校验文案。
 */
export async function createTaskAction(
  locale: Locale,
  input: CreateTaskInput,
): Promise<ActionResult<Task>> {
  assertMockApiRunning();
  // 参数来自浏览器，类型约束不了实际传来的值。
  if (!hasLocale(routing.locales, locale)) {
    throw new Error(`Unsupported locale: ${String(locale)}`);
  }
  const t = await getTranslations({ locale, namespace: "demo-task" });
  const data = createTaskInputSchema(t).parse(input);
  try {
    const task = await createTask(data);
    updateTag(TASK_LIST_TAG);
    return { ok: true, data: task };
  } catch (error) {
    if (error instanceof ApiError && error.code === TASK_NAME_TAKEN) {
      return { ok: false, code: error.code };
    }
    throw error;
  }
}
