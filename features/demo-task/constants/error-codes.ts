// Data demo 需要识别的 Mock API 业务错误码，值与 scripts/mock-api/envelope.mjs 的 ErrorCode 一致。

/** 创建或重命名时名称已被其他任务占用。 */
export const TASK_NAME_TAKEN = 40901;
/** 只有 failed 的任务能重试；任务可能已经在别处被重试过。 */
export const TASK_NOT_RETRYABLE = 40902;
