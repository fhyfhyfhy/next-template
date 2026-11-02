import { DomainError, errorBody } from "./domain-error";
import type { ApiErrorObject } from "./fetch";

/**
 * Server Action 返回给浏览器的结果。预期的业务失败返回和 Route Handler 失败响应里同样的 `error` 对象，
 * 提示文案由调用方按 `code` 和 `params` 生成；意外错误照常抛出，跨过 Flight 后只剩通用错误。
 */
export type ActionResult<TData> =
  { ok: true; data: TData } | { ok: false; error: ApiErrorObject };

/**
 * Server Action 里调用数据层：成功时返回 `{ ok: true, data }`；数据层按 `expectedCodes` 里的业务码拒绝时返回
 * `{ ok: false, error }`，由浏览器按码提示。其他错误照常抛出：跨过 Flight 后只剩通用错误，走全局提示。
 */
export async function toActionResult<TData>(
  run: () => Promise<TData>,
  expectedCodes: readonly number[] = [],
): Promise<ActionResult<TData>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof DomainError && expectedCodes.includes(error.code)) {
      return { ok: false, error: errorBody(error).error };
    }
    throw error;
  }
}

/**
 * Server Action 返回的预期业务失败。`code` 是数据层拒绝时的业务错误码，`param`、`params` 和 `ApiError` 的
 * 同名字段一样，UI 按它们生成文案。
 */
export class ActionError extends Error {
  readonly code: number;
  /** 出错的请求字段名。 */
  readonly param: string | undefined;
  /** 翻译文案需要的插值数据。 */
  readonly params: Record<string, string | number> | undefined;

  constructor({ code, message, param, params }: ApiErrorObject) {
    super(`Server Action failed with code ${code}: ${message}`);
    this.name = "ActionError";
    this.code = code;
    this.param = param;
    this.params = params;
  }
}

/**
 * 给调用 Server Action 的 `mutationFn` 用：成功时返回数据，`ok: false` 时抛出 `ActionError`。
 * React Query 把任何 resolve 的值都当成功，不转换的话失败的写入也会走 `onSuccess`。
 */
export function unwrapActionResult<TData>(result: ActionResult<TData>): TData {
  if (!result.ok) throw new ActionError(result.error);
  return result.data;
}

export function isActionError(
  error: unknown,
  code: number,
): error is ActionError {
  return error instanceof ActionError && error.code === code;
}
