/**
 * 这次 build 是否提供 /demos 下的 Demo（UI demo 和 Data demo）：`next dev` 下提供，`scripts/run-next.mjs --demo`
 * 的 demo build 也提供；普通的生产 build 不提供，由 proxy.ts 对它们返回 404。两个变量都在 build 时内联，
 * 运行中的服务打不开它们。
 */
export const DEMOS_SERVED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_MOCK_API === "1";
