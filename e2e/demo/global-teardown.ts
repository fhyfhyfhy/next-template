import { MOCK_API_URL } from "./mock-api";

/**
 * 用 E2E_REUSE_SERVER=1 复用自己开的服务调试时，Mock API 跟着那个服务继续运行。跑完后恢复种子数据、
 * 清掉故障、让时钟重新走，免得它停在最后一个测试留下的状态上。Mock API 已经随 e2e 自己的
 * demo:start 关掉时，没有要恢复的东西，请求失败也不影响结果。
 */
export default async function globalTeardown() {
  await fetch(`${MOCK_API_URL}/__mock/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paused: false }),
  }).catch(() => {});
}
