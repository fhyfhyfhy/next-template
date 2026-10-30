"use server";

import {
  createServerValidate,
  ServerValidateError,
} from "@tanstack/react-form-nextjs";
import { updateTag } from "next/cache";

import { ApiError, fetchApi } from "@/lib/fetch";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { TASK_NAME_TAKEN } from "../constants/error-codes";
import {
  createTaskFormOptions,
  type CreateTaskFormState,
  createTaskInputSchema,
} from "./create-task";
import { taskSchema } from "./get-task";

const serverValidate = createServerValidate({
  ...createTaskFormOptions,
  onServerValidate: createTaskInputSchema,
});

/**
 * 创建任务，供 `useActionState` 使用，也是表单 JS 接管之前原生提交的目标。服务端重新校验输入；
 * 校验失败和名称被占用时返回字段错误。成功后让列表页的服务端缓存失效，Server Action 的响应会带回刷新后的列表。
 */
export async function createTaskAction(
  _previous: CreateTaskFormState | undefined,
  formData: FormData,
): Promise<CreateTaskFormState> {
  let values;
  try {
    values = await serverValidate(formData);
  } catch (error) {
    if (error instanceof ServerValidateError) return error.formState;
    throw error;
  }
  try {
    const task = await fetchApi({
      url: "/demo/tasks",
      method: "POST",
      // serverValidate 返回的是提交的原值，parse 一遍取 schema 处理后的值（去掉首尾空白）。
      data: createTaskInputSchema.parse(values),
      schema: taskSchema,
      auth: false,
    });
    updateTag(TASK_LIST_TAG);
    return { createdTaskId: task.id };
  } catch (error) {
    if (error instanceof ApiError && error.code === TASK_NAME_TAKEN) {
      // 和 schema 校验错误同一个结构，表单按同样的方式显示在名称字段下。
      return {
        values,
        errors: [],
        errorMap: {
          onServer: { fields: { name: [{ message: "名称已被其他任务占用" }] } },
        },
      };
    }
    throw error;
  }
}
