import { MOCK_API_RUNNING } from "../constants/mock-api";

/**
 * Data demo 的每个 Server Action 先调用它。action 是可以直接 POST 调用的服务端入口，页面只显示说明也挡不住，
 * 不检查的话，用普通命令运行时 Demo 的写入会发到项目的真实后端。
 */
export function assertMockApiRunning() {
  if (!MOCK_API_RUNNING) {
    throw new Error(
      "The Data demo runs only against the Mock API; start it with pnpm demo:dev",
    );
  }
}
