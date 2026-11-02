"use server";

import { updateTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";
import { assertDemoBackendEnabled } from "../server/connection";

/**
 * 只让任务列表的服务端缓存失效，不写数据。给不经过 Server Action 的变化用：浏览器轮询发现的、Demo 生成器
 * 推进的任务状态，以及别的客户端做的修改。列表页的缓存需要这条授权的失效路径才能立即反映结果。
 */
export async function expireTaskListAction() {
  assertDemoBackendEnabled();
  updateTag(TASK_LIST_TAG);
}
