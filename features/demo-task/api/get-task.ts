import { ApiError, fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import { TASK_STEP_INTERVAL_MS } from "../constants/task-rules";
import { taskSchema } from "../types/task";
import type { TaskStatus } from "../types/task-filters";

export type { Task } from "../types/task";

export function isTaskActive(status: TaskStatus | undefined) {
  return status === "pending" || status === "running";
}

export function isTaskNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

const getTask = (id: string) =>
  fetchApi({ url: `/api/demo/tasks/${id}`, schema: taskSchema });

/**
 * 任务详情。浏览器经 Route Handler 请求；服务端 prefetch 时展开这份 options、把 `queryFn` 换成数据层的
 * `getTask`（features/demo-task/server.ts），两边得到同样结构的数据（types/task.ts）。
 */
export const getTaskQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["demo-task", "task", "detail", id],
    queryFn: () => getTask(id),
    // 任务在 pending、running 时会自己推进。进度的 freshness bound 是 Demo generator 的一步，按这个间隔轮询，
    // 用户停留在页面上能看到每一步；到终态或任务已被删除后停止轮询。
    refetchInterval: (query) =>
      isTaskActive(query.state.data?.status) &&
      !isTaskNotFound(query.state.error)
        ? TASK_STEP_INTERVAL_MS
        : false,
    meta: {
      // 任务在别处被删除后 refetch 得到 404，详情页显示“已删除”，不再弹通用提示。
      suppressErrorToast: isTaskNotFound,
    },
  });
