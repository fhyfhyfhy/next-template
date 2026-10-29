import { defineConfig, devices } from "@playwright/test";

// Data demo 的 e2e：对着带 Mock API 的生产构建运行，缓存新鲜度和 prefetch 只有在 next start 下才可信。
// 端口 3000 已有服务时直接复用（比如开着 pnpm demos 调试）；交付前的完整验证要在没有服务时运行。
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
    command:
      "node scripts/run-next.mjs build --demos && node scripts/run-next.mjs start --demos",
    url: "http://localhost:3000/demos",
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
