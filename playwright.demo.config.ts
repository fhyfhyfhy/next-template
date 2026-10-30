import { defineConfig, devices } from "@playwright/test";

// 固定用不常用的端口：避开 3000 起 dev/start 自动顺延的那几个端口，也和项目 e2e 的 3998（playwright.config.ts）错开。
const PORT = 3999;
const BASE_URL = `http://localhost:${PORT}`;

// Data demo 的 e2e（pnpm demo:test:e2e）：对着带 Mock API 的生产构建运行，缓存新鲜度和 prefetch 只有在 next start 下才可信。
// 默认总是自己 build 并启动；调试时设 E2E_REUSE_SERVER=1 复用这个端口上已有的服务
// （比如 pnpm demo:dev --port 3999），这时依赖生产行为的用例（如预取）会失败。
export default defineConfig({
  testDir: "./e2e/demo",
  // 和项目 e2e（playwright.config.ts）分开输出目录，同时跑时互不清空。
  outputDir: "test-results/demo",
  // 所有测试共用一个 Mock API 的内存状态和故障配置，只能串行。
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: "list",
  globalTeardown: "./e2e/demo/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm demo:build && pnpm demo:start --port ${PORT}`,
    url: `${BASE_URL}/demos`,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
  },
});
