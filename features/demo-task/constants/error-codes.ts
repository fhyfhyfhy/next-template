// Mock API 的业务错误码，值与 scripts/mock-api/envelope.mjs 的 ErrorCode 一致。

/** 创建或重命名时名称已被其他任务占用。 */
export const TASK_NAME_TAKEN = 40901;
/** 只有 failed 的任务能重试；任务可能已经在别处被重试过。 */
export const TASK_NOT_RETRYABLE = 40902;
/** 任务完成前没有 3D 模型文件可下载。 */
export const TASK_NOT_DONE = 40903;
/** 评论去掉首尾空白后不在 1 到 500 字之间。 */
export const COMMENT_CONTENT_INVALID = 40904;
