import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import { taskPageSchema } from "../types/task";
import type { TaskFilters } from "../types/task-filters";

export type { TaskPage } from "../types/task";

/** 所有任务列表形态的 query key 前缀，invalidate 它会刷新普通列表、作品广场和搜索结果。 */
export const taskListKey = ["task", "task", "list"] as const;

const getTasks = (filters: TaskFilters) =>
  fetchApi({
    url: "/api/tasks",
    params: { ...filters },
    schema: taskPageSchema,
  });

export const getTasksQueryOptions = (filters: TaskFilters) =>
  queryOptions({
    queryKey: [...taskListKey, filters] as const,
    queryFn: () => getTasks(filters),
  });

/** 任务列表 query 的筛选条件。服务端预取用它调用数据层，读到的数据和 key 对应同一组条件。 */
export const taskFiltersOf = ({
  queryKey,
}: {
  queryKey: readonly [...typeof taskListKey, TaskFilters];
}) => queryKey[3];

/** 详情页的相关任务：prompt 相同的其他任务。prompt 来自详情 query，拿到之前调用方不启用它。 */
export const relatedTasksQueryOptions = (
  taskId: string,
  prompt: string | undefined,
) => getTasksQueryOptions({ prompt, excludeId: taskId, pageSize: 5 });

/** “我的收藏”侧栏的列表，按创建时间从新到旧；收藏的乐观更新按同样的顺序加入任务（update-task-favorite.ts）。 */
export const favoriteTasksQueryOptions = () =>
  getTasksQueryOptions({ favorite: true, sort: "created_desc", pageSize: 50 });

/** 进行中任务的 freshness bound：header 徽标的数量和全部任务页的任务状态，最多比实际晚这么久。 */
const ACTIVE_TASKS_FRESHNESS_MS = 3000;
/** 没有进行中的任务时，别处新建的任务最多晚这么久出现。 */
const IDLE_FRESHNESS_MS = 10_000;

/**
 * 进行中的任务：header 徽标显示总数，全部任务页比较其中的 id 和状态，有变化就重新读取列表。
 * 任务会自己推进：有进行中的任务时按它们的 freshness bound 轮询，没有时放慢；回到标签页时总是立即刷新，
 * 用户离开期间的变化不等下一次轮询。`staleTime` 只让服务端预取的数据 hydrate 后不必马上重新请求。
 * 一页取到上限 50 条；超过时 `hasMore` 为 true，之后的任务只体现在 `total` 里。
 */
export const activeTasksQueryOptions = () =>
  queryOptions({
    ...getTasksQueryOptions({ status: ["pending", "running"], pageSize: 50 }),
    staleTime: ACTIVE_TASKS_FRESHNESS_MS,
    refetchOnWindowFocus: "always",
    refetchInterval: (query) =>
      (query.state.data?.total ?? 0) > 0
        ? ACTIVE_TASKS_FRESHNESS_MS
        : IDLE_FRESHNESS_MS,
  });
