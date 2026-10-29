import "server-only";
import { cacheLife, cacheTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import type { TaskFilters } from "../types/task-filters";
import { getFeedPage } from "./get-feed";
import { getTasks } from "./get-tasks";

// 服务端缓存的读取放在 server-only 模块：`use cache` 函数不能进客户端 bundle，
// 而 get-tasks.ts、get-feed.ts 还被浏览器里的 query 工厂引用。请求都是公开接口（auth: false），可以缓存。

/**
 * 列表页由 Server Component 负责，读取结果按筛选条件缓存。任务状态会随时间自动推进，列表只是快照，
 * 缓存时长取得较短；名称、收藏、封面和增删这类用户写入由 Server Action 用 updateTag 立即失效。
 */
export async function getCachedTaskPage(filters: TaskFilters) {
  "use cache";
  cacheLife({ stale: 30, revalidate: 5, expire: 60 });
  cacheTag(TASK_LIST_TAG);
  return getTasks(filters);
}

/**
 * 作品广场第一页及其读取时刻，进入静态 shell。数据和时间戳来自同一次缓存，一起失效、一起前进，
 * 作为 hydration 的 `updatedAt` 时才能正确覆盖浏览器里更旧的 query。
 */
export async function getCachedFeedSnapshot() {
  "use cache";
  cacheLife("minutes");
  cacheTag(TASK_LIST_TAG);
  return { page: await getFeedPage(1), fetchedAt: Date.now() };
}
