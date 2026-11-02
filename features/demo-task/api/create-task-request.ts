import { z } from "zod";

import { fetchApi } from "@/lib/fetch";

import type { DemoTaskTranslator } from "../types/translator";
import { createTaskNameSchema, taskSchema } from "./get-task";

const PROMPT_MAX_LENGTH = 500;

/**
 * Validates the input for creating a task, shared by the form in the browser
 * and `createTaskAction` on the server; the `t` passed in builds the messages.
 */
export const createTaskInputSchema = (t: DemoTaskTranslator) =>
  z.object({
    name: createTaskNameSchema(t),
    prompt: z
      .string()
      .trim()
      .min(1, t("validation.promptRequired"))
      .max(
        PROMPT_MAX_LENGTH,
        t("validation.promptTooLong", { max: PROMPT_MAX_LENGTH }),
      ),
  });
export type CreateTaskInput = z.input<ReturnType<typeof createTaskInputSchema>>;
/** Validated input, with leading and trailing whitespace trimmed. */
type CreateTaskData = z.output<ReturnType<typeof createTaskInputSchema>>;

/**
 * `data` is the value `createTaskInputSchema` parsed. Its type is the same as
 * unvalidated input, so validating is the caller's job (`createTaskAction`).
 */
export const createTask = (data: CreateTaskData) =>
  fetchApi({
    url: "/demo/tasks",
    method: "POST",
    data,
    schema: taskSchema,
    auth: false,
  });
