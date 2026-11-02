import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import { taskPageSchema } from "../types/task";
import type { TaskFilters } from "../types/task-filters";

export type { TaskPage } from "../types/task";

/** 所有任务列表形态的 query key 前缀，invalidate 它会刷新普通列表、作品广场和搜索结果。 */
export const taskListKey = ["demo-task", "task", "list"] as const;

const getTasks = (filters: TaskFilters) =>
  fetchApi({
    url: "/api/demo/tasks",
    params: { ...filters },
    schema: taskPageSchema,
  });

export const getTasksQueryOptions = (filters: TaskFilters) =>
  queryOptions({
    queryKey: [...taskListKey, filters],
    queryFn: () => getTasks(filters),
  });

/** “我的收藏”侧栏的列表，按创建时间从新到旧；收藏的乐观更新按同样的顺序加入任务（update-task-favorite.ts）。 */
export const favoriteTasksQueryOptions = () =>
  getTasksQueryOptions({ favorite: true, sort: "created_desc", pageSize: 50 });

/**
 * 进行中的任务：header 徽标显示总数，全部任务页比较其中的 id 和状态，有变化就重新读取列表。
 * 任务会自己推进，标签页重新获得焦点时要立即刷新，所以不沿用全局 60 秒的 staleTime。
 * 一页取到上限 50 条；超过时 `hasMore` 为 true，之后的任务只体现在 `total` 里。
 */
export const activeTasksQueryOptions = () =>
  queryOptions({
    ...getTasksQueryOptions({ status: ["pending", "running"], pageSize: 50 }),
    staleTime: 0,
  });
