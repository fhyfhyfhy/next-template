"use server";

import { updateTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";

/**
 * 只让任务列表的服务端缓存失效，不写数据。给 generator 推进的任务状态用：它不经过 Server Action，
 * 浏览器的变化信号发现后调用这里。列表页的缓存需要这条授权的失效路径才能立即反映结果。
 */
export async function expireTaskListAction() {
  updateTag(TASK_LIST_TAG);
}
