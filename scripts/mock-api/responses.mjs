// The Mock API's response format, which must match what lib/fetch/index.ts parses (its schema is
// the reference): a success returns the resource itself, a failure is a 4xx or 5xx with
// `{ error: { code, message, param?, params? } }`. A change to the response format changes only
// this file (setup-data-access skill).

/**
 * Business error codes, whose first three digits are the response's HTTP status. The codes the
 * Data demo has to recognize have constants of the same value in
 * features/demo-task/constants/error-codes.ts.
 */
export const ErrorCode = {
  BAD_REQUEST: 40000,
  COMMENT_CONTENT_INVALID: 40001,
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

/** A list without pagination. */
export function list(items) {
  return success({ items });
}

/**
 * A list paginated by page number; `result` comes from store.mjs's `paginate`, and `toWire` turns
 * each record into its response format.
 */
export function paginated({ items, total, hasMore, page, pageSize }, toWire) {
  return success({ items: items.map(toWire), total, hasMore, page, pageSize });
}

export function created(data) {
  return { status: 201, body: data };
}

export function noContent() {
  return { status: 204 };
}

/**
 * `details` holds the optional `param` (the request field at fault) and `params` (values to
 * interpolate into the translated copy).
 */
export function apiError(status, code, message, details) {
  return { status, body: { error: { code, message, ...details } } };
}

/**
 * Invalid request parameters; `code` defaults to the generic BAD_REQUEST, and a parameter error
 * with a specific meaning passes its own code.
 */
export function badRequest(message, details, code = ErrorCode.BAD_REQUEST) {
  return apiError(400, code, message, details);
}

export function notFound(message) {
  return apiError(404, ErrorCode.NOT_FOUND, message);
}

/**
 * The request conflicts with the resource's current state, such as a name already taken or a task
 * that cannot be retried in its status.
 */
export function conflict(code, message, details) {
  return apiError(409, code, message, details);
}

/**
 * Any 4xx or 5xx response, for fault injection; the code is SERVER_ERROR for every 5xx and the
 * status times 100 for a 4xx.
 */
export function httpError(status, message) {
  const code = status >= 500 ? ErrorCode.SERVER_ERROR : status * 100;
  return apiError(status, code, message);
}

/**
 * A 2xx whose body is only the error object, for fault injection: it mimics a backend that can
 * report failures only with a 2xx.
 */
export function errorOnSuccess(code, message) {
  return apiError(200, code, message);
}

/**
 * A 2xx whose body matches no endpoint's schema, to show a contract mismatch between frontend and
 * backend.
 */
export function malformedSuccess() {
  return success({ unexpected: true });
}
