import type { FullConfig } from "@playwright/test";

/**
 * 用 E2E_REUSE_SERVER=1 复用自己开的服务调试时，那个服务的 Demo 后端会停在最后一个测试留下的状态上。
 * 跑完后恢复种子数据、清掉故障、让时钟重新走。服务已经随 e2e 自己的 demo:start 关掉时，请求失败也不影响结果。
 */
export default async function globalTeardown(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  await fetch(new URL("/api/demo/control/reset", baseURL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paused: false }),
  }).catch(() => {});
}
