/**
 * 这次 build 是否提供 /demos 下的 Demo（UI demo 和 Data demo）：`next dev` 下提供，`scripts/run-next.mjs --demo`
 * 的 demo build 也提供；普通的生产 build 不提供，由 proxy.ts 对它们返回 404。demo build 由 DEMO_DATABASE_URL 标识，
 * 它同时决定产物目录（scripts/build-dirs.mjs）：给普通 build 的 start 设上它，读的就是 `.next-demo` 而不是这份产物。
 */
export const DEMOS_SERVED =
  process.env.NODE_ENV !== "production" ||
  Boolean(process.env.DEMO_DATABASE_URL);
