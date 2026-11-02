"use server";

import { updateTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { assertDemoBackendEnabled } from "../server/connection";
import { resetDemo } from "../server/lab";

/**
 * 把 Demo 后端恢复成种子数据，清除故障和调用记录，默认延迟恢复成 500 ms；时钟保持当前状态（e2e 暂停后从这里
 * 重置，时钟仍然停着）。同时让任务列表的服务端缓存失效。
 */
export async function resetDemoAction() {
  assertDemoBackendEnabled();
  await resetDemo();
  updateTag(TASK_LIST_TAG);
}
