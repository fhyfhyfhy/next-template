"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { ApiError, fetchApi } from "@/lib/fetch";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { TASK_NAME_TAKEN } from "../constants/error-codes";
import { type CreateTaskFormState, createTaskInputSchema } from "./create-task";
import { taskSchema } from "./get-task";

/**
 * 创建任务，供 `useActionState` 使用。服务端重新校验输入；校验失败和名称被占用时返回字段错误，
 * 由表单显示在对应字段下。成功后让列表页的服务端缓存失效，Server Action 的响应会带回刷新后的列表。
 */
export async function createTaskAction(
  _previous: CreateTaskFormState,
  formData: FormData,
): Promise<CreateTaskFormState> {
  const submitted = {
    name: String(formData.get("name") ?? ""),
    prompt: String(formData.get("prompt") ?? ""),
  };
  const parsed = createTaskInputSchema.safeParse(submitted);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      values: submitted,
      fieldErrors: {
        name: fieldErrors.name?.[0],
        prompt: fieldErrors.prompt?.[0],
      },
    };
  }
  try {
    const task = await fetchApi({
      url: "/demo/tasks",
      method: "POST",
      data: parsed.data,
      schema: taskSchema,
      auth: false,
    });
    updateTag(TASK_LIST_TAG);
    return { createdTaskId: task.id };
  } catch (error) {
    if (error instanceof ApiError && error.code === TASK_NAME_TAKEN) {
      return {
        values: submitted,
        fieldErrors: { name: "名称已被其他任务占用" },
      };
    }
    throw error;
  }
}
