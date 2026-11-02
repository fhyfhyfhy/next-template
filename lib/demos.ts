/**
 * Whether this build serves the demos under /demos (the UI demo and the Data
 * demo): under `next dev`, and in the demo builds of `scripts/run-next.mjs
 * --demo`. Never in a plain production build, where proxy.ts answers 404 for
 * them. Both variables are inlined when the code is built, so a running server
 * cannot turn them on.
 */
export const DEMOS_SERVED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_MOCK_API === "1";
