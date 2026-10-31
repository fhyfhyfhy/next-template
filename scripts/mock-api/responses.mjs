// Mock API 的响应格式，必须和 lib/fetch.ts 解析的格式一致（以它的 schema 为准）：
// 成功直接返回资源，失败是 4xx 或 5xx 加 `{ error: { code, message, param?, params? } }`。
// 项目调整响应格式时只改这个文件（setup-data-access skill）。

/** 业务错误码，Data demo 在 features/demo-task 的 constants 里有同值的常量。 */
export const ErrorCode = {
  BAD_REQUEST: 40000,
  NOT_FOUND: 40400,
  TASK_NAME_TAKEN: 40901,
  TASK_NOT_RETRYABLE: 40902,
  TASK_NOT_DONE: 40903,
  SERVER_ERROR: 50000,
};

/** @returns {{ status: number, body: unknown }} */
export function success(data) {
  return { status: 200, body: data };
}

/** 不分页的列表。 */
export function list(items) {
  return success({ items });
}

/** 页码分页的列表；`result` 来自 store.mjs 的 `paginate`，`toWire` 把每条记录转成响应里的格式。 */
export function paginated({ items, total, hasMore, page, pageSize }, toWire) {
  return success({ items: items.map(toWire), total, hasMore, page, pageSize });
}

export function created(data) {
  return { status: 201, body: data };
}

export function noContent() {
  return { status: 204 };
}

/** `details` 是可选的 `param`（出错的请求字段）和 `params`（翻译文案的插值数据）。 */
export function apiError(status, code, message, details) {
  return { status, body: { error: { code, message, ...details } } };
}

export function badRequest(message, details) {
  return apiError(400, ErrorCode.BAD_REQUEST, message, details);
}

export function notFound(message) {
  return apiError(404, ErrorCode.NOT_FOUND, message);
}

/** 请求和资源的当前状态冲突，比如名称已被占用、任务不在可重试的状态。 */
export function conflict(code, message, details) {
  return apiError(409, code, message, details);
}

/** 任意 4xx、5xx 响应，故障注入用；5xx 的 code 统一为 SERVER_ERROR，4xx 为状态码乘 100。 */
export function httpError(status, message) {
  const code = status >= 500 ? ErrorCode.SERVER_ERROR : status * 100;
  return apiError(status, code, message);
}

/** 2xx 但响应体只有 error 对象，模拟只能用 2xx 返回失败的后端，故障注入用。 */
export function errorOnSuccess(code, message) {
  return apiError(200, code, message);
}

/** 2xx，但响应体不符合任何接口的 schema，用来演示前后端契约不一致。 */
export function malformedSuccess() {
  return success({ unexpected: true });
}
