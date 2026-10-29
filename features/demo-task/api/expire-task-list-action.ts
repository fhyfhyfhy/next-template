"use server";

import { updateTag } from "next/cache";

import { TASK_LIST_TAG } from "../constants/cache-tags";

/**
 * 只让任务列表的服务端缓存失效，不写数据。给只能在浏览器完成的写入用：写入本身不经过 Next 服务端，
 * 列表页的缓存需要这条授权的失效路径才能立即反映结果。
 */
export async function expireTaskListAction() {
  updateTag(TASK_LIST_TAG);
}
