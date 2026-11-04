import { env } from "@/lib/env";

/**
 * 这次 build 是否提供 /demos 下的 Demo。`next dev` 和 demo:* 命令的 build 提供，普通的生产 build 不提供；
 * demo:* 命令会设置 `DEMO_DATABASE_URL`（scripts/run-next.mjs），所以用它识别 demo build。
 */
export const DEMOS_SERVED =
  process.env.NODE_ENV !== "production" ||
  env.DEMO_DATABASE_URL !== undefined;
