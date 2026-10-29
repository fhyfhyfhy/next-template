// Mock API 的响应格式，必须和 lib/fetch.ts 解析的格式一致：`{ code, data, message }` 信封，`code` 为 0 是成功，
// 业务失败是 HTTP 200 加非 0 的 code。项目调整 lib/fetch.ts 的响应格式时只改这个文件（setup-data-access skill）。

export const SUCCESS_CODE = 0;

/** 业务错误码，Data demo 在 features/demo-task 的 constants 里有同值的常量。 */
export const ErrorCode = {
  BAD_REQUEST: 40000,
  NOT_FOUND: 40400,
  TASK_NAME_TAKEN: 40901,
  TASK_NOT_RETRYABLE: 40902,
  TASK_NOT_DONE: 40903,
  COMMENT_CONTENT_INVALID: 40904,
  SERVER_ERROR: 50000,
};

/** @returns {{ status: number, body: unknown }} */
export function success(data) {
  return { status: 200, body: { code: SUCCESS_CODE, data, message: "ok" } };
}

/** 业务规则拒绝了请求：HTTP 200，信封里是失败的 code。 */
export function businessError(code, message) {
  return { status: 200, body: { code, data: null, message } };
}

export function badRequest(message) {
  return {
    status: 400,
    body: { code: ErrorCode.BAD_REQUEST, data: null, message },
  };
}

export function notFound(message) {
  return {
    status: 404,
    body: { code: ErrorCode.NOT_FOUND, data: null, message },
  };
}

export function serverError(status, message) {
  return {
    status,
    body: { code: ErrorCode.SERVER_ERROR, data: null, message },
  };
}

/** 信封合法、`code` 是成功值，但 `data` 不符合任何接口的 schema，用来演示前后端契约不一致。 */
export function malformedSuccess() {
  return success({ unexpected: true });
}
