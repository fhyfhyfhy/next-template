import "server-only";
import { cacheLife, cacheTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { getFeedPage } from "./get-feed";

// 服务端缓存的读取放在 server-only 模块：`use cache` 函数不能进客户端 bundle，
// 而 get-feed.ts 还被浏览器里的 query 工厂引用。请求是公开接口（auth: false），可以缓存。

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
