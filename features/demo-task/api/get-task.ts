import { z } from "zod";

import { ApiError, fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import { TASK_NAME_MAX_LENGTH } from "../constants/task-rules";
import { taskSchema } from "../types/task";
import type { TaskStatus } from "../types/task-filters";
import type { DemoTaskTranslator } from "../types/translator";

export type { Task } from "../types/task";

/**
 * 任务名称的规则：去掉首尾空白后 1 到 40 个字，和数据层的校验一致。创建、重命名的表单和 action 共用，
 * 校验文案由调用方传入的 `t` 按当前 locale 生成。
 */
export const createTaskNameSchema = (t: DemoTaskTranslator) =>
  z
    .string()
    .trim()
    .min(1, t("validation.nameRequired"))
    .max(
      TASK_NAME_MAX_LENGTH,
      t("validation.nameTooLong", { max: TASK_NAME_MAX_LENGTH }),
    );

/** 运行中的任务每次轮询的间隔，和 Demo 生成器推进一步的间隔一致。 */
const POLL_INTERVAL_MS = 1500;

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
    // 任务在 pending、running 时会自己推进，用户停留在页面上也要看到进度；到终态或任务已被删除后停止轮询。
    refetchInterval: (query) =>
      isTaskActive(query.state.data?.status) &&
      !isTaskNotFound(query.state.error)
        ? POLL_INTERVAL_MS
        : false,
    meta: {
      // 任务在别处被删除后 refetch 得到 404，详情页显示“已删除”，不再弹通用提示。
      suppressErrorToast: isTaskNotFound,
    },
  });
