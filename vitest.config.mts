import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// pnpm test 跑 Demo feature 以外的所有 *.test.*，包括项目自己 feature 的数据库测试（*.db.test.*）。Demo feature
// （features/demo-*）的测试由 pnpm demo:test 运行（vitest.demo.config.mts）；e2e/ 下的 *.spec.ts 由 Playwright 运行
// （playwright.config.ts、playwright.demo.config.ts）。
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
    include: ["**/*.test.?(c|m)[jt]s?(x)"],
    // Claude Code 把 worktree 建在仓库内；每个 worktree 在自己的 checkout 里跑测试。
    exclude: [
      ...configDefaults.exclude,
      ".claude/worktrees/**",
      "features/demo-*/**",
    ],
    environment: "node",
  },
});
