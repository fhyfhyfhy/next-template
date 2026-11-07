import { z } from "zod";

import type { Translator } from "@/lib/i18n/translator";

import { TASK_PROMPT_MAX_LENGTH } from "../constants/task-rules";
import { createTaskNameSchema } from "./task-name-schema";

/** 创建任务的输入校验，浏览器里的表单和服务端的 `createTaskAction` 共用；校验文案由传入的 `t` 生成。 */
export const createTaskInputSchema = (t: Translator) =>
  z.object({
    name: createTaskNameSchema(t),
    prompt: z
      .string()
      .trim()
      .min(1, t("task.validation.promptRequired"))
      .max(
        TASK_PROMPT_MAX_LENGTH,
        t("task.validation.promptTooLong", {
          max: TASK_PROMPT_MAX_LENGTH,
        }),
      ),
  });
export type CreateTaskInput = z.input<ReturnType<typeof createTaskInputSchema>>;
