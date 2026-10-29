import { z } from "zod";

import { taskNameSchema } from "./get-task";

/** 创建表单的校验规则，浏览器里的 TanStack Form 和服务端的 `createTaskAction` 共用。 */
export const createTaskInputSchema = z.object({
  name: taskNameSchema,
  prompt: z
    .string()
    .trim()
    .min(1, "请输入 prompt")
    .max(500, "prompt 最多 500 个字"),
});
export type CreateTaskInput = z.input<typeof createTaskInputSchema>;

export const createTaskDefaultValues: CreateTaskInput = {
  name: "",
  prompt: "",
};

/**
 * `createTaskAction` 交给 `useActionState` 的状态。失败时 `values` 是提交的值，`fieldErrors` 是服务端的字段错误；
 * 成功时只有 `createdTaskId`，它变化时调用方重置表单。
 */
export interface CreateTaskFormState {
  createdTaskId?: string;
  values?: CreateTaskInput;
  fieldErrors?: Partial<Record<keyof CreateTaskInput, string>>;
}
