"use server";

import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import type { Locale } from "@/lib/i18n/routing";
import type { Translator } from "@/lib/i18n/translator";
import type { ActionResult } from "@/lib/request/action-result";
import { toActionResult } from "@/lib/request/action-result";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { TASK_NAME_TAKEN } from "../constants/error-codes";
import { renameTask } from "../server/tasks";
import type { Task } from "../types/task";
import { createTaskNameSchema } from "./task-name-schema";

const createRenameInputSchema = (t: Translator) =>
  z.object({
    taskId: z.string().min(1),
    name: createTaskNameSchema(t),
  });

/**
 * 重命名任务。名称被占用是预期失败，返回 `ok: false`；其他错误照常抛出。
 * Server Action 读不到 `[locale]`，`locale` 由调用方传入，用来生成校验文案。
 */
export async function updateTaskAction(
  locale: Locale,
  input: z.input<ReturnType<typeof createRenameInputSchema>>,
): Promise<ActionResult<Task>> {
  const t = await getTranslations({ locale });
  const { taskId, name } = createRenameInputSchema(t).parse(input);
  const result = await toActionResult(
    () => renameTask(taskId, { name }),
    [TASK_NAME_TAKEN],
  );
  if (result.ok) updateTag(TASK_LIST_TAG);
  return result;
}
