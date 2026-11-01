import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// `pnpm test`: every *.test.* file. The e2e/ specs (*.spec.ts) are
// Playwright's (playwright.config.ts, playwright.demo.config.ts).
export default defineConfig({
  resolve: {
    // tsconfig.json's `@/*`, for the app code a test imports.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.?(c|m)[jt]s?(x)"],
    // Claude Code makes its worktrees inside the repo; each worktree runs its
    // own tests.
    exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
    environment: "node",
  },
});
