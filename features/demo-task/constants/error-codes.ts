// The Mock API business error codes the Data demo needs to recognize; the
// values match ErrorCode in scripts/mock-api/responses.mjs.

/** On create or rename, another task already uses the name. */
export const TASK_NAME_TAKEN = 40901;
/**
 * Only a failed task can be retried; it may already have been retried
 * elsewhere.
 */
export const TASK_NOT_RETRYABLE = 40902;
