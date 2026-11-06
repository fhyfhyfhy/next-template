import { defineConfig, devices } from "@playwright/test";

// 端口避开 3000 起 dev/start 自动顺延的那几个端口；同一台机器上另一份 checkout 也在跑 e2e 时，用 E2E_PORT 换一个端口。
// 两份 checkout 共用 compose.yaml 里的 e2e 数据集，不能同时跑。
const PORT = Number(process.env.E2E_PORT ?? 3998);
const BASE_URL = `http://localhost:${PORT}`;

// 对着生产构建运行：缓存新鲜度和 prefetch 只有在 next start 下才可信。build 之前先把 e2e 数据集恢复成种子数据，
// 预渲染进静态 shell 的数据和测试开始时库里的一致。
// 调试时设 E2E_REUSE_SERVER=1 复用这个端口上已有的服务，比如先 LOCAL_DATASET=e2e pnpm db:reset，再设
// LOCAL_DATASET=e2e TASK_GENERATOR_ENABLED=false 运行 pnpm dev --port 3998；这时依赖生产行为的用例（如预取）会失败。
export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/e2e",
  // 用例共用 e2e 数据集里的种子数据，有的断言会读全局的计数（比如进行中的任务数），只能串行。
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  // 设备预设的 locale 是 en-US，页面会按 Accept-Language 显示英文；用例默认看默认 locale 的页面。
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], locale: "zh-CN" },
    },
  ],
  webServer: {
    // 即 db:reset、build:local 和 start:local。直接用 node 调用：只装了 corepack 的环境里 PATH 上没有 pnpm。
    command: `node scripts/local-services/reset.mjs e2e && node scripts/run-next.mjs build --local && node scripts/run-next.mjs start --local --port ${PORT}`,
    env: {
      // 打开 instant() 依赖的测试 API，产物也因此放进单独的目录，不覆盖正在运行的 start（next.config.ts）。
      EXPOSE_TESTING_API: "1",
      LOCAL_DATASET: "e2e",
      // 任务只按用例的安排推进（e2e/backend.ts 的 `advance`），不由后台的 generator 推进。
      TASK_GENERATOR_ENABLED: "false",
    },
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
  },
});
