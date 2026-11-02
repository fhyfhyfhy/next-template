import { defineConfig, devices } from "@playwright/test";

// Ports nothing else uses by default: clear of 3000 and the ports after it,
// which dev and start try in turn, and of the app e2e's 3998
// (playwright.config.ts).
// When another checkout on the same machine is running the demos' e2e too,
// choose other ports with DEMO_E2E_PORT and DEMO_E2E_MOCK_API_PORT.
const PORT = Number(process.env.DEMO_E2E_PORT ?? 3999);
const BASE_URL = `http://localhost:${PORT}`;
// The e2e's own Mock API, apart from the demo:* commands' default 4010: the
// specs reset its data, pause its clock and inject faults, which must not
// touch a running demo:dev.
// Set in process.env: webServer's build and start inherit it, and
// e2e/demo/mock-api.ts reads it in the test process.
const MOCK_API_PORT = process.env.DEMO_E2E_MOCK_API_PORT ?? "4999";
process.env.MOCK_API_PORT = MOCK_API_PORT;

// The demos' e2e (pnpm demo:test:e2e) runs against a demo production build
// with the Mock API: cache freshness and prefetching can be trusted only under
// next start.
// By default it always builds and starts its own server; while debugging, set
// E2E_REUSE_SERVER=1 to reuse a server already on this port (for example
// pnpm demo:dev --port 3999 run with MOCK_API_PORT=4999, the Mock API port
// above), and the specs that depend on production behavior, such as
// prefetching, then fail.
export default defineConfig({
  testDir: "./e2e/demo",
  // An output directory apart from the app e2e's (playwright.config.ts), so
  // neither set empties the other's when both run.
  outputDir: "test-results/demo",
  // Every test shares one Mock API's in-memory state and faults, so the tests
  // run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: "list",
  globalTeardown: "./e2e/demo/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  // The device preset's locale is en-US, for which the proxy would redirect an
  // unprefixed URL to /en by Accept-Language; the specs see the default
  // locale's pages.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], locale: "zh-CN" },
    },
  ],
  webServer: {
    // That is, pnpm demo:build and demo:start. Called through node: where only
    // corepack is installed, pnpm is not on PATH.
    command: `node scripts/run-next.mjs build --demo && node scripts/run-next.mjs start --demo --port ${PORT}`,
    // Turns on the testing API that instant() relies on, which also puts the
    // build in a directory of its own, so it does not overwrite a running
    // demo:start (next.config.ts).
    env: { EXPOSE_TESTING_API: "1", MOCK_API_PORT },
    url: `${BASE_URL}/demos`,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
  },
});
