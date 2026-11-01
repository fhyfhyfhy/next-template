import "server-only";
import { cacheLife, cacheTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { listTasks } from "../server/tasks";
import type { TaskFilters } from "../types/task-filters";

// `use cache` 函数不能进客户端 bundle，所以放在 server-only 模块。

/**
 * 列表页由 Server Component 负责，读取结果按筛选条件缓存。任务状态会随时间自动推进，列表只是快照，
 * 缓存时长取得较短；名称、收藏、封面和增删这类用户写入由 Server Action 用 updateTag 立即失效。
 */
export async function getCachedTaskPage(filters: TaskFilters) {
  "use cache";
  cacheLife({ stale: 30, revalidate: 5, expire: 60 });
  cacheTag(TASK_LIST_TAG);
  return listTasks(filters);
}
