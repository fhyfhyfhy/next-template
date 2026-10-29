import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import type { TaskFilters } from "../types/task-filters";
import { taskSchema } from "./get-task";

/** 所有任务列表形态的 query key 前缀，invalidate 它会刷新普通列表、作品广场和搜索结果。 */
export const taskListKey = ["demo-task", "task", "list"] as const;

export const taskPageSchema = z
  .object({
    items: z.array(taskSchema),
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
    has_more: z.boolean(),
  })
  .transform(({ page_size, has_more, ...page }) => ({
    ...page,
    pageSize: page_size,
    hasMore: has_more,
  }));
export type TaskPage = z.infer<typeof taskPageSchema>;

export const getTasks = ({
  status,
  favorite,
  prompt,
  excludeId,
  sort,
  page,
  pageSize,
}: TaskFilters) =>
  fetchApi({
    url: "/demo/tasks",
    params: {
      status,
      favorite,
      prompt,
      exclude_id: excludeId,
      sort,
      page,
      page_size: pageSize,
    },
    schema: taskPageSchema,
    auth: false,
  });

export const getTasksQueryOptions = (filters: TaskFilters) =>
  queryOptions({
    queryKey: [...taskListKey, filters],
    queryFn: () => getTasks(filters),
  });

/**
 * header 徽标显示的进行中任务数。任务会自己推进，标签页重新获得焦点时要立即刷新，
 * 所以不沿用全局 60 秒的 staleTime。
 */
export const activeTasksQueryOptions = () =>
  queryOptions({
    ...getTasksQueryOptions({ status: ["pending", "running"], pageSize: 1 }),
    staleTime: 0,
  });
