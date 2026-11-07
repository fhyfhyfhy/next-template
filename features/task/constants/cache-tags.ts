/**
 * 所有任务列表类服务端缓存读取共用的 tag，列表页和作品广场的缓存靠它立即失效：创建、重命名、收藏、重试、
 * 删除和换封面的 Server Action 写入后调用 updateTag，别的客户端的这些写入也会让缓存失效。
 * generator 推进的任务状态不经过 Server Action，由浏览器的变化信号发现后调用 `expireTaskListAction` 失效。
 */
export const TASK_LIST_TAG = "task:list";
