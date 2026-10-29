/**
 * 所有任务列表类服务端缓存读取共用的 tag。任务的名称、收藏、封面、是否存在发生变化时，
 * 写入它的 Server Action 用 updateTag 让列表页和作品广场的缓存立即失效。
 */
export const TASK_LIST_TAG = "demo-task:list";
