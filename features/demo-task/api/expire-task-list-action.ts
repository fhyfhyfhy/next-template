"use server";

import { updateTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";

/**
 * 只让任务列表的服务端缓存失效，不写数据。给不经过 Next 服务端的变化用：浏览器直接完成的写入，
 * 以及浏览器轮询发现的、后端自己推进的任务状态。列表页的缓存需要这条授权的失效路径才能立即反映结果。
 */
export async function expireTaskListAction() {
  updateTag(TASK_LIST_TAG);
}
