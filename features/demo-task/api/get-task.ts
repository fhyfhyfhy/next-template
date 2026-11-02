import { z } from "zod";

import { ApiError, fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import { type TaskStatus, taskStatusSchema } from "../types/task-filters";
import type { DemoTaskTranslator } from "../types/translator";

const TASK_NAME_MAX_LENGTH = 40;

/**
 * The task name rule: 1 to 40 characters after trimming, matching the Mock
 * API's validation. The create and rename forms and actions share it; the `t`
 * the caller passes builds the messages in the current locale.
 */
export const createTaskNameSchema = (t: DemoTaskTranslator) =>
  z
    .string()
    .trim()
    .min(1, t("validation.nameRequired"))
    .max(
      TASK_NAME_MAX_LENGTH,
      t("validation.nameTooLong", { max: TASK_NAME_MAX_LENGTH }),
    );

export const taskSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    prompt: z.string(),
    status: taskStatusSchema,
    progress: z.number(),
    favorite: z.boolean(),
    cover_url: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
  })
  .transform(({ cover_url, created_at, updated_at, ...task }) => ({
    ...task,
    coverUrl: cover_url,
    createdAt: created_at,
    updatedAt: updated_at,
  }));
export type Task = z.infer<typeof taskSchema>;

/**
 * How often a running task is polled, the same interval at which the Mock API
 * advances it a step.
 */
const POLL_INTERVAL_MS = 1500;

export function isTaskActive(status: TaskStatus | undefined) {
  return status === "pending" || status === "running";
}

export function isTaskNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export const getTask = (id: string) =>
  fetchApi({ url: `/demo/tasks/${id}`, schema: taskSchema, auth: false });

export const getTaskQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["demo-task", "task", "detail", id],
    queryFn: () => getTask(id),
    // A pending or running task advances on its own, and a user who stays on
    // the page should see the progress. Polling stops at a final state or once
    // the task is deleted.
    refetchInterval: (query) =>
      isTaskActive(query.state.data?.status) &&
      !isTaskNotFound(query.state.error)
        ? POLL_INTERVAL_MS
        : false,
    meta: {
      // After the task is deleted elsewhere, a refetch gets a 404; the detail
      // page shows it as deleted instead of a generic toast.
      suppressErrorToast: isTaskNotFound,
    },
  });
