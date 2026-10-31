import { defineConfig, devices } from "@playwright/test";

// 固定用不常用的端口：避开 3000 起 dev/start 自动顺延的那几个端口，也和项目 e2e 的 3998（playwright.config.ts）错开。
const PORT = 3999;
const BASE_URL = `http://localhost:${PORT}`;
// e2e 自己的 Mock API，和 demo:* 命令默认的 4010 分开：测试会重置数据、暂停时钟、注入故障，不能动到开着的 demo:dev。
// 写进 process.env：webServer 的 build 和 start 继承它，测试进程里的 e2e/demo/mock-api.ts 也读它。
const MOCK_API_PORT = "4999";
process.env.MOCK_API_PORT = MOCK_API_PORT;

// Data demo 的 e2e（pnpm demo:test:e2e）：对着带 Mock API 的生产构建运行，缓存新鲜度和 prefetch 只有在 next start 下才可信。
// 默认总是自己 build 并启动；调试时设 E2E_REUSE_SERVER=1 复用这个端口上已有的服务（比如设 MOCK_API_PORT=4999
// 后运行 pnpm demo:dev --port 3999，Mock API 端口要和上面一致），这时依赖生产行为的用例（如预取）会失败。
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
    // 即 pnpm demo:build 和 demo:start。直接用 node 调用：只装了 corepack 的环境里 PATH 上没有 pnpm。
    command: `node scripts/run-next.mjs build --demo && node scripts/run-next.mjs start --demo --port ${PORT}`,
    // 打开 instant() 依赖的测试 API，产物也因此放进单独的目录，不覆盖正在运行的 demo:start（next.config.ts）。
    env: { EXPOSE_TESTING_API: "1", MOCK_API_PORT },
    url: `${BASE_URL}/demos`,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
  },
});
