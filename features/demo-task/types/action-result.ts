/**
 * Server Action 返回给浏览器的结果。预期的业务失败只返回错误码，提示文案由调用方按码生成；
 * 意外错误照常抛出，跨过 Flight 后只剩通用错误。
 */
export type ActionResult<TData> =
  { ok: true; data: TData } | { ok: false; code: number };
