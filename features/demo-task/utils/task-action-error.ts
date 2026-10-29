import type { ActionResult } from "../types/action-result";

/** Server Action 返回的预期业务失败，`code` 是 Mock API 的业务错误码。 */
export class TaskActionError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "TaskActionError";
    this.code = code;
  }
}

/**
 * 给调用 Server Action 的 `mutationFn` 用：成功时返回数据，`ok: false` 时抛出 `TaskActionError`。
 * React Query 把任何 resolve 的值都当成功，不转换的话失败的写入也会走 `onSuccess`。
 */
export function unwrapActionResult<TData>(result: ActionResult<TData>): TData {
  if (!result.ok) throw new TaskActionError(result.code, result.message);
  return result.data;
}

export function isTaskActionError(error: unknown, code: number) {
  return error instanceof TaskActionError && error.code === code;
}
