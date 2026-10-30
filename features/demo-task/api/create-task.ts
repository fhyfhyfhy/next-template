import {
  formOptions,
  type FormValidateAsyncFn,
  type ServerFormState,
} from "@tanstack/react-form-nextjs";
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

const defaultValues: CreateTaskInput = { name: "", prompt: "" };

/** 浏览器里的 `useForm` 和服务端的 `createServerValidate` 共用的表单选项。 */
export const createTaskFormOptions = formOptions({
  defaultValues,
  validators: { onChange: createTaskInputSchema },
});

/**
 * `createTaskAction` 交给 `useActionState` 的状态。失败时是 TanStack Form 的服务端表单状态，表单用 `mergeForm`
 * 把其中的字段错误合并进来；成功时只有 `createdTaskId`，它变化时调用方重新挂载表单来清空。
 */
export type CreateTaskFormState =
  | ServerFormState<CreateTaskInput, FormValidateAsyncFn<CreateTaskInput>>
  | { createdTaskId: string };
