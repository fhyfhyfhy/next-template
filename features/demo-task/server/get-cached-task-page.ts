import "server-only";
import { cacheLife, cacheTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import type { TaskFilters } from "../types/task-filters";
import { listTasks } from "./tasks";

/**
 * 列表页由 Server Component 负责，读取结果按筛选条件缓存。用户写入由 Server Action 用 updateTag 立即失效；
 * 进行中任务的状态变化由变化信号在它的 freshness bound（3 秒，见 `activeTasksQueryOptions`）内失效。
 * 变化信号看不到的变化，比如筛选结果里新出现的已完成任务，靠这里的缓存时长兜底：条目最多保留 `expire` 的 60 秒，
 * stale-while-revalidate 下触发重新生成的那次请求仍拿到旧条目，浏览器 router 再复用 `stale` 的 30 秒（下限），
 * 所以这类变化最多晚约 90 秒。
 */
export async function getCachedTaskPage(filters: TaskFilters) {
  "use cache";
  cacheLife({ stale: 30, revalidate: 5, expire: 60 });
  cacheTag(TASK_LIST_TAG);
  return listTasks(filters);
}
