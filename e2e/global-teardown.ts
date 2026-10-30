import { MOCK_API_URL } from "./mock-api";

/**
 * 开着 demo:dev 时 e2e 和它共用 Mock API（scripts/run-next.mjs 复用已运行的实例）。跑完后恢复种子数据、
 * 清掉故障、让时钟重新走，免得 demo:dev 停在最后一个测试留下的状态上。Mock API 已经随 e2e 自己的
 * demo:start 关掉时，没有要恢复的东西，请求失败也不影响结果。
 */
export default async function globalTeardown() {
  await fetch(`${MOCK_API_URL}/__mock/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paused: false }),
  }).catch(() => {});
}
