import "server-only";
import { cacheLife, cacheTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { listFeed } from "../server/tasks";
import { FEED_PAGE_SIZE } from "./get-feed";

// `use cache` 函数不能进客户端 bundle，所以放在 server-only 模块。

/**
 * 作品广场第一页及其读取时刻，进入静态 shell。数据和时间戳来自同一次缓存，一起失效、一起前进，
 * 作为 hydration 的 `updatedAt` 时才能正确覆盖浏览器里更旧的 query。
 */
export async function getCachedFeedSnapshot() {
  "use cache";
  cacheLife("minutes");
  cacheTag(TASK_LIST_TAG);
  return { page: await listFeed(null, FEED_PAGE_SIZE), fetchedAt: Date.now() };
}
