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
 * Creates a task. A taken name is an expected failure and returns `ok: false`;
 * other errors are thrown as usual. On success it expires the list page's
 * server cache, and the Server Action's response brings back the refreshed
 * list. A Server Action can't read `[locale]`, so the caller passes `locale`
 * for the validation messages.
 */
export async function createTaskAction(
  locale: Locale,
  input: CreateTaskInput,
): Promise<ActionResult<Task>> {
  assertMockApiRunning();
  // The arguments come from the browser; their types don't constrain what
  // actually arrives.
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
