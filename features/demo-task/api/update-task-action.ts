"use server";

import { updateTag } from "next/cache";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { ApiError, fetchApi } from "@/lib/fetch";
import { type Locale, routing } from "@/lib/i18n/routing";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { TASK_NAME_TAKEN } from "../constants/error-codes";
import type { ActionResult } from "../types/action-result";
import type { DemoTaskTranslator } from "../types/translator";
import { assertMockApiRunning } from "../utils/assert-mock-api-running";
import { createTaskNameSchema, type Task, taskSchema } from "./get-task";

const createRenameInputSchema = (t: DemoTaskTranslator) =>
  z.object({
    taskId: z.string().min(1),
    name: createTaskNameSchema(t),
  });

/**
 * Renames a task. A taken name is an expected failure and returns `ok: false`;
 * other errors are thrown as usual. A Server Action can't read `[locale]`, so
 * the caller passes `locale` for the validation messages.
 */
export async function updateTaskAction(
  locale: Locale,
  input: z.input<ReturnType<typeof createRenameInputSchema>>,
): Promise<ActionResult<Task>> {
  assertMockApiRunning();
  // The arguments come from the browser; their types don't constrain what
  // actually arrives.
  if (!hasLocale(routing.locales, locale)) {
    throw new Error(`Unsupported locale: ${String(locale)}`);
  }
  const t = await getTranslations({ locale, namespace: "demo-task" });
  const { taskId, name } = createRenameInputSchema(t).parse(input);
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
