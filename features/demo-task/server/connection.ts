import "server-only";

import { createDb } from "@/lib/db";
import { env } from "@/lib/env";

import type { TaskTables } from "./tables";

/**
 * Demo 后端是否启用：只有 demo:* 命令和数据层测试会设置 `DEMO_DATABASE_URL`（scripts/demo-backend/datasets.mjs），
 * 普通的 dev、build、start 和部署都没有它，这时 Data demo 页面只显示说明，`/api/demo` 全部返回 404，
 * Server Action 拒绝执行，也不会创建数据库连接。服务端每个入口都要先判断：Next 并行渲染 layout 和 page，
 * layout 只显示说明时 page 里的读取照样执行；Server Action 和 Route Handler 也能被直接请求。
 */
export function isDemoBackendEnabled() {
  return env.DEMO_DATABASE_URL !== undefined;
}

/** Demo 数据库的连接串，Demo 后端没有启用时抛错。 */
export function demoDatabaseUrl() {
  const url = env.DEMO_DATABASE_URL;
  if (url === undefined) {
    throw new Error(
      "The Demo backend is not enabled; run the Demo with pnpm demo:dev",
    );
  }
  return url;
}

/** Server Action 和控制入口先调用它，Demo 后端没有启用时拒绝执行。 */
export function assertDemoBackendEnabled() {
  demoDatabaseUrl();
}

export function getTaskDb() {
  return createDb<TaskTables>(demoDatabaseUrl());
}
