import { defineConfig, devices } from "@playwright/test";

// 项目自己的 e2e（pnpm test:e2e），不含 e2e/demo/ 下 Data demo 的 e2e（playwright.demo.config.ts）。
// 端口避开 3000 起 dev/start 自动顺延的那几个端口，也和 Data demo e2e 的 3999 错开，两套可以同时跑。
const PORT = 3998;
const BASE_URL = `http://localhost:${PORT}`;

// 对着生产构建运行；调试时设 E2E_REUSE_SERVER=1 复用这个端口上已有的服务（比如 pnpm dev --port 3998）。
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "demo/**",
  // 两套 e2e 各用自己的输出目录：Playwright 开始时会清空 outputDir，共用时同时跑会删掉对方的 trace。
  outputDir: "test-results/e2e",
  forbidOnly: true,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    // build 时打开 instant() 依赖的测试 API（next.config.ts）。
    env: { EXPOSE_TESTING_API: "1" },
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
  },
});
