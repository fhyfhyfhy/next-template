// task 的业务错误码，前三位是 HTTP status。数据层（server/）按业务规则拒绝时抛出，Route Handler 和
// Server Action 原样带给浏览器，界面按码选择文案。通用错误码在 lib/domain-error.ts，各 feature 的码不能重复。

/** 评论内容去掉首尾空白后为空或太长。 */
export const COMMENT_CONTENT_INVALID = 40001;
/** 创建或重命名时名称已被其他任务占用。 */
export const TASK_NAME_TAKEN = 40901;
/** 只有 failed 的任务能重试；任务可能已经在别处被重试过。 */
export const TASK_NOT_RETRYABLE = 40902;
/** 任务完成后才有模型文件可下载。 */
export const TASK_NOT_DONE = 40903;
