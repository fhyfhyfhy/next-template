import { defineConfig, devices } from "@playwright/test";

// 默认用不常用的端口：避开 3000 起 dev/start 自动顺延的那几个端口，也和项目 e2e 的 3998（playwright.config.ts）错开。
// 同一台机器上另一份 checkout 也在跑 Demo 的 e2e 时，用 DEMO_E2E_PORT 换端口；两份 checkout 共用 compose 里的
// demo_e2e 库，不能同时跑。
const PORT = Number(process.env.DEMO_E2E_PORT ?? 3999);
const BASE_URL = `http://localhost:${PORT}`;

// Demo 的 e2e（pnpm demo:test:e2e）：对着启用了 Demo backend 的 demo 生产构建运行，缓存新鲜度和 prefetch 只有在
// next start 下才可信。默认总是自己 build 并启动；调试时设 E2E_REUSE_SERVER=1 复用这个端口上已有的服务（比如设
// DEMO_DATASET=e2e 后运行 pnpm demo:dev --port 3999，让它用 e2e 的数据集），这时依赖生产行为的用例（如预取）会失败。
export default defineConfig({
  testDir: "./e2e/demo",
  // 和项目 e2e（playwright.config.ts）分开输出目录，同时跑时互不清空。
  outputDir: "test-results/demo",
  // 所有测试共用 e2e 数据集的数据和故障配置，只能串行。
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: "list",
  globalTeardown: "./e2e/demo/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  // 设备预设的 locale 是 en-US，页面会按 Accept-Language 显示英文；用例看默认 locale 的页面。
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], locale: "zh-CN" },
    },
  ],
  webServer: {
    // 即 pnpm demo:build 和 demo:start。直接用 node 调用：只装了 corepack 的环境里 PATH 上没有 pnpm。
    command: `node scripts/run-next.mjs build --demo && node scripts/run-next.mjs start --demo --port ${PORT}`,
    // 打开 instant() 依赖的测试 API，产物也因此放进单独的目录，不覆盖正在运行的 demo:start（next.config.ts）。
    // e2e 数据集有自己的库和 bucket，测试的重置、暂停时钟和故障不会动到开着的 demo:dev。
    env: { EXPOSE_TESTING_API: "1", DEMO_DATASET: "e2e" },
    url: `${BASE_URL}/demos`,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
  },
});
