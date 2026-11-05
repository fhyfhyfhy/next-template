import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

import { demoEnv } from "./scripts/demo-backend/datasets.mjs";

const TEST_FILES = "**/*.test.?(c|m)[jt]s?(x)";
const DB_TEST_FILES = "**/*.db.test.?(c|m)[jt]s?(x)";
const DEMO_FEATURES = "features/demo-*/**";
// Claude Code 把 worktree 建在仓库内；每个 worktree 在自己的 checkout 里跑测试。
const EXCLUDE = [...configDefaults.exclude, ".claude/worktrees/**"];

// 三个项目，e2e/ 下的 *.spec.ts 由 Playwright 运行（playwright.config.ts、playwright.demo.config.ts）：
// - app（pnpm test）：Demo feature 以外的所有测试，包括项目自己 feature 的数据库测试（*.db.test.*）。
// - demo-unit：Demo feature 的单元测试，不需要 Docker；提交时 lint-staged 对暂存的 Demo 文件跑相关的测试（lint-staged.config.mjs）。
// - demo-db：Demo feature 的数据库测试，连接 compose.demo.yaml 里真实的 Postgres 和对象存储，用 test 数据集，
//   和 demo:dev、e2e 的数据互不影响。pnpm demo:test 跑 demo-unit 和 demo-db。
export default defineConfig({
  resolve: {
    alias: {
      // 和 tsconfig.json 的 paths 一致，被测代码里的 @/ 才能解析。
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // 数据层模块带 import "server-only"，它在 react-server 条件之外会直接抛错；测试进程不是 React 服务端环境。
      "server-only": fileURLToPath(
        new URL("node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "app",
          include: [TEST_FILES],
          exclude: [...EXCLUDE, DEMO_FEATURES],
        },
      },
      {
        extends: true,
        test: {
          name: "demo-unit",
          include: [`features/demo-*/${TEST_FILES}`],
          exclude: [...EXCLUDE, DB_TEST_FILES],
        },
      },
      {
        extends: true,
        test: {
          name: "demo-db",
          include: [`features/demo-*/${DB_TEST_FILES}`],
          exclude: EXCLUDE,
          globalSetup: "./scripts/demo-backend/test-setup.mjs",
          env: demoEnv("test"),
          // 所有测试共用一个库和 bucket，每个测试都先重置，只能串行。
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
