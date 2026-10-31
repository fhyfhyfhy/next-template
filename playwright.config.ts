import { defineConfig, devices } from "@playwright/test";

// 项目自己的 e2e（pnpm test:e2e），不含 e2e/demo/ 下 Data demo 的 e2e（playwright.demo.config.ts）。
// 端口避开 3000 起 dev/start 自动顺延的那几个端口，也和 Data demo e2e 的 3999 错开，两套可以同时跑。
// 同一台机器上另一份 checkout 也在跑 e2e 时，用 E2E_PORT 换一个端口。
const PORT = Number(process.env.E2E_PORT ?? 3998);
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
    // 即 pnpm build 和 start。直接用 node 调用：只装了 corepack 的环境里 PATH 上没有 pnpm。
    command: `node scripts/run-next.mjs build && node scripts/run-next.mjs start --port ${PORT}`,
    // 打开 instant() 依赖的测试 API，产物也因此放进单独的目录，不覆盖正在运行的 start（next.config.ts）。
    env: { EXPOSE_TESTING_API: "1" },
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
  },
});
