import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

import { localEnv } from "./scripts/local-services/datasets.mjs";

const TEST_FILES = "**/*.test.?(c|m)[jt]s?(x)";
const DB_TEST_FILES = "**/*.db.test.?(c|m)[jt]s?(x)";
// Claude Code 把 worktree 建在仓库内；每个 worktree 在自己的 checkout 里跑测试。
const EXCLUDE = [...configDefaults.exclude, ".claude/worktrees/**"];

// pnpm test 跑两个项目，e2e/ 下的 *.spec.ts 由 Playwright 运行（playwright.config.ts）：
// - unit：数据库测试以外的所有测试，不需要 Docker；提交时 lint-staged 只跑暂存文件相关的这部分（lint-staged.config.mjs）。
// - db：连接 compose.yaml 里真实的 Postgres 和对象存储的测试（*.db.test.*），比如数据层和种子数据，用 test 数据集，
//   和 pnpm dev、e2e 的数据互不影响。
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
          name: "unit",
          include: [TEST_FILES],
          exclude: [...EXCLUDE, DB_TEST_FILES],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: [DB_TEST_FILES],
          exclude: EXCLUDE,
          globalSetup: "./scripts/local-services/test-setup.mjs",
          setupFiles: ["./scripts/local-services/test-reset.mjs"],
          env: localEnv("test"),
          // 所有测试共用一个库和 bucket，每个测试都先恢复成种子数据，只能串行。
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
