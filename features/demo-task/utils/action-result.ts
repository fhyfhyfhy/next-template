import { DomainError } from "@/lib/domain-error";

import type { ActionResult } from "../types/action-result";

/**
 * Server Action 里调用数据层：成功时返回 `{ ok: true, data }`；数据层按 `expectedCodes` 里的业务码拒绝时返回
 * `{ ok: false, code }`，由浏览器按码提示。其他错误照常抛出：跨过 Flight 后只剩通用错误，走全局提示。
 */
export async function toActionResult<TData>(
  run: () => Promise<TData>,
  expectedCodes: readonly number[] = [],
): Promise<ActionResult<TData>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof DomainError && expectedCodes.includes(error.code)) {
      return { ok: false, code: error.code };
    }
    throw error;
  }
}
