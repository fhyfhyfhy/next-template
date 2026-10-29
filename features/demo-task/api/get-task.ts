import { z } from "zod";

import { ApiError, fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import { TASK_STATUSES } from "../constants/task-list";
import type { TaskStatus } from "../types/task-filters";

export const taskStatusSchema = z.enum(TASK_STATUSES);

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

/** 运行中的任务每次轮询的间隔，和 Mock API 推进一步的间隔一致。 */
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
    // 任务在 pending、running 时会自己推进，用户停留在页面上也要看到进度；到终态后停止轮询。
    refetchInterval: (query) =>
      isTaskActive(query.state.data?.status) ? POLL_INTERVAL_MS : false,
    meta: {
      // 任务在别处被删除后 refetch 得到 404，详情页显示“已删除”，不再弹通用提示。
      suppressErrorToast: isTaskNotFound,
    },
  });
