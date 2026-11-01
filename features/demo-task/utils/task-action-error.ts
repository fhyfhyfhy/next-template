import type { ActionResult } from "../types/action-result";

/**
 * An expected business failure returned by a Server Action; `code` is the Mock
 * API's business error code.
 */
export class TaskActionError extends Error {
  readonly code: number;

  constructor(code: number) {
    super(`Server Action failed with code ${code}`);
    this.name = "TaskActionError";
    this.code = code;
  }
}

/**
 * For a `mutationFn` that calls a Server Action: returns the data on success
 * and throws `TaskActionError` on `ok: false`. React Query treats any resolved
 * value as success, so without this a failed write would reach `onSuccess` too.
 */
export function unwrapActionResult<TData>(result: ActionResult<TData>): TData {
  if (!result.ok) throw new TaskActionError(result.code);
  return result.data;
}

export function isTaskActionError(
  error: unknown,
  code: number,
): error is TaskActionError {
  return error instanceof TaskActionError && error.code === code;
}
