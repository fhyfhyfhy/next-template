import { defineConfig, devices } from "@playwright/test";

// Data demo 的 e2e：对着带 Mock API 的生产构建运行，缓存新鲜度和 prefetch 只有在 next start 下才可信。
// 默认总是自己 build 并启动；调试时设 E2E_REUSE_SERVER=1 复用 3000 端口上已有的服务（比如 pnpm demo:dev），
// 这时依赖生产行为的用例（如预取）会失败。
export default defineConfig({
  testDir: "./e2e",
  // 所有测试共用一个 Mock API 的内存状态和故障配置，只能串行。
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // 显式指定端口：demo:start 默认遇到 3000 被占会换端口，e2e 要和 baseURL 一致。
    command: "pnpm demo:build && pnpm demo:start --port 3000",
    url: "http://localhost:3000/demos",
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
  },
});
