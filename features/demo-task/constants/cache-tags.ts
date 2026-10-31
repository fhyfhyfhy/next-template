/**
 * 所有任务列表类服务端缓存读取共用的 tag，列表页和作品广场的缓存靠它立即失效：创建、重命名、收藏、重试、
 * 删除的 Server Action 写入后调用 updateTag；不经过 Next 服务端的变化（浏览器上传的封面、Mock API 自己推进的
 * 任务状态、故障实验室的重置）由 `expireTaskListAction` 失效。
 */
export const TASK_LIST_TAG = "demo-task:list";
