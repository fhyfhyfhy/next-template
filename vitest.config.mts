import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// 单元测试（pnpm test）。只认 *.test.*：e2e/ 下的 *.spec.ts 由 Playwright 运行（playwright.config.ts、playwright.demo.config.ts）。
export default defineConfig({
  resolve: {
    // 和 tsconfig.json 的 paths 一致，被测代码里的 @/ 才能解析。
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.?(c|m)[jt]s?(x)"],
    // Claude Code 把 worktree 建在仓库内；每个 worktree 在自己的 checkout 里跑测试。
    exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
    environment: "node",
    // next-intl 的 navigation 引入 `next/navigation` 时不带扩展名，只有 bundler 解析得了；让 Vite 打包 next-intl，
    // 而不是交给 Node，就能解析。
    server: { deps: { inline: ["next-intl"] } },
  },
});
