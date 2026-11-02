import "server-only";
import { cacheLife, cacheTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import type { TaskFilters } from "../types/task-filters";
import { getTasks } from "./get-tasks";

// The server cache read lives in a server-only module: a `use cache` function
// can't go into the client bundle, and the browser's query factories import
// get-tasks.ts too. The request is to a public endpoint (auth: false), so it
// can be cached.

/**
 * A Server Component owns the list page, and reads are cached per filter. Task
 * status advances over time and the list is only a snapshot, so the cache life
 * is short; user writes such as rename, favorite, cover, create and delete
 * expire it at once through updateTag in a Server Action.
 */
export async function getCachedTaskPage(filters: TaskFilters) {
  "use cache";
  cacheLife({ stale: 30, revalidate: 5, expire: 60 });
  cacheTag(TASK_LIST_TAG);
  return getTasks(filters);
}
