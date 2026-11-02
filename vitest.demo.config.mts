import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

import { demoEnv } from "./scripts/demo-backend/datasets.mjs";

// Demo 后端的数据层测试（pnpm demo:test）：连接 compose.demo.yaml 里真实的 Postgres 和对象存储，用 test 数据集，
// 和 demo:dev、e2e 的数据互不影响。需要 Docker，所以不放进 pnpm test；只认 *.db.test.*，vitest.config.mts 排除它们。
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // 数据层模块带 import "server-only"，它在 react-server 条件之外会直接抛错；测试进程不是 React 服务端环境。
      "server-only": fileURLToPath(
        new URL("node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    include: ["**/*.db.test.?(c|m)[jt]s?(x)"],
    exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
    environment: "node",
    globalSetup: "./scripts/demo-backend/test-setup.mjs",
    env: demoEnv("test"),
    // 所有测试共用一个库和 bucket，每个测试都先重置，只能串行。
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
