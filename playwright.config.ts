import { defineConfig, devices } from "@playwright/test";

// The app's own e2e (pnpm test:e2e); the Data demo's specs under e2e/demo/ are
// the other set (playwright.demo.config.ts).
// The port stays clear of 3000 and the ports after it, which dev and start try
// in turn, and of the Data demo e2e's 3999, so the two sets can run at once.
// When another checkout on the same machine is running e2e too, choose another
// port with E2E_PORT.
const PORT = Number(process.env.E2E_PORT ?? 3998);
const BASE_URL = `http://localhost:${PORT}`;

// Runs against a production build; while debugging, set E2E_REUSE_SERVER=1 to
// reuse a server already on this port (for example pnpm dev --port 3998).
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "demo/**",
  // Each e2e set has its own output directory: Playwright empties outputDir
  // when it starts, so with a shared one, two sets running at once would
  // delete each other's traces.
  outputDir: "test-results/e2e",
  forbidOnly: true,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  // The device preset's locale is en-US, for which the proxy would redirect an
  // unprefixed URL to /en by Accept-Language; by default the specs see the
  // default locale's pages.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], locale: "zh-CN" },
    },
  ],
  webServer: {
    // That is, pnpm build and start. Called through node: where only corepack
    // is installed, pnpm is not on PATH.
    command: `node scripts/run-next.mjs build && node scripts/run-next.mjs start --port ${PORT}`,
    // Turns on the testing API that instant() relies on, which also puts the
    // build in a directory of its own, so it does not overwrite a running
    // start (next.config.ts).
    env: { EXPOSE_TESTING_API: "1" },
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
  },
});
