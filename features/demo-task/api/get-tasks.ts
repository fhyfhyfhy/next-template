import type { z } from "zod";

import { fetchApi, pageSchema } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import type { TaskFilters } from "../types/task-filters";
import { taskSchema } from "./get-task";

/** 所有任务列表形态的 query key 前缀，invalidate 它会刷新普通列表、作品广场和搜索结果。 */
export const taskListKey = ["demo-task", "task", "list"] as const;

export const taskPageSchema = pageSchema(taskSchema);
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

/** “我的收藏”侧栏的列表；作品广场收藏时，乐观更新在这里加入或移除任务。 */
export const favoriteTasksQueryOptions = () =>
  getTasksQueryOptions({ favorite: true, pageSize: 50 });

/**
 * 进行中的任务：header 徽标显示总数，全部任务页比较其中的 id 和状态，有变化就重新读取列表。
 * 任务会自己推进，标签页重新获得焦点时要立即刷新，所以不沿用全局 60 秒的 staleTime。
 * 一页取到 Mock API 的上限 50 条；超过时 `hasMore` 为 true，之后的任务只体现在 `total` 里。
 */
export const activeTasksQueryOptions = () =>
  queryOptions({
    ...getTasksQueryOptions({ status: ["pending", "running"], pageSize: 50 }),
    staleTime: 0,
  });
