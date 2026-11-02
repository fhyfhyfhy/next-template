import { z } from "zod";

import { fetchApi } from "@/lib/fetch";

import type { DemoTaskTranslator } from "../types/translator";
import { createTaskNameSchema, taskSchema } from "./get-task";

const PROMPT_MAX_LENGTH = 500;

/** 创建任务的输入校验，浏览器里的表单和服务端的 `createTaskAction` 共用；校验文案由传入的 `t` 生成。 */
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
/** 校验通过的输入：首尾空白已经去掉。 */
type CreateTaskData = z.output<ReturnType<typeof createTaskInputSchema>>;

/** `data` 是 `createTaskInputSchema` 解析后的值；类型和未校验的输入相同，校验由调用方（`createTaskAction`）负责。 */
export const createTask = (data: CreateTaskData) =>
  fetchApi({
    url: "/demo/tasks",
    method: "POST",
    data,
    schema: taskSchema,
    auth: false,
  });
