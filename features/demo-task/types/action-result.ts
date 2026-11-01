/**
 * What a Server Action returns to the browser. An expected business failure
 * returns only its error code, and the caller picks the message by code. An
 * unexpected error is thrown as usual and arrives across Flight as a generic
 * error.
 */
export type ActionResult<TData> =
  { ok: true; data: TData } | { ok: false; code: number };
