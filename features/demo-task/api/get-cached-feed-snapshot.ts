import "server-only";
import { cacheLife, cacheTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { getFeedPage } from "./get-feed";

// The server cache read lives in a server-only module: a `use cache` function
// can't go into the client bundle, and the browser's query factories import
// get-feed.ts too. The request is to a public endpoint (auth: false), so it can
// be cached.

/**
 * The Gallery's first page and the time it was read, for the static shell. The
 * data and the timestamp come from the same cache entry and expire and move
 * forward together, so as the hydration's `updatedAt` the timestamp correctly
 * overrides older queries in the browser.
 */
export async function getCachedFeedSnapshot() {
  "use cache";
  cacheLife("minutes");
  cacheTag(TASK_LIST_TAG);
  return { page: await getFeedPage(1), fetchedAt: Date.now() };
}
