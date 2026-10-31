import { z } from "zod";

import { fetchApi } from "@/lib/fetch";

import { taskNameSchema, taskSchema } from "./get-task";

/** 创建任务的输入校验，浏览器里的表单和服务端的 `createTaskAction` 共用。 */
export const createTaskInputSchema = z.object({
  name: taskNameSchema,
  prompt: z
    .string()
    .trim()
    .min(1, "请输入 prompt")
    .max(500, "prompt 最多 500 个字"),
});
export type CreateTaskInput = z.input<typeof createTaskInputSchema>;

export const createTask = (input: CreateTaskInput) =>
  fetchApi({
    url: "/demo/tasks",
    method: "POST",
    // parse 后的值去掉了首尾空白；无效输入在发请求前就抛错。
    data: createTaskInputSchema.parse(input),
    schema: taskSchema,
    auth: false,
  });
