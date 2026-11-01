"use server";

import { updateTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { assertMockApiRunning } from "../utils/assert-mock-api-running";

/**
 * Expires the task lists' server cache without writing data. For changes that
 * bypass the Next server: writes the browser makes directly, and task status
 * the backend advances on its own, which the browser's polling finds. The list
 * page's cache needs this authorized expiry path to reflect them at once.
 */
export async function expireTaskListAction() {
  assertMockApiRunning();
  updateTag(TASK_LIST_TAG);
}
