import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test as base } from "../test";

// The e2e observes and sets up conditions only through the browser and the
// Mock API's control endpoints; it imports no application code.
// playwright.demo.config.ts sets the port. Without it this throws rather than
// fall back to the demo:* commands' default port: that is the Mock API a
// running demo:dev uses.
const mockApiPort = process.env.MOCK_API_PORT;
if (!mockApiPort) {
  throw new Error(
    "MOCK_API_PORT is not set; run these specs with playwright.demo.config.ts",
  );
}
export const MOCK_API_URL = `http://127.0.0.1:${mockApiPort}`;

export interface MockFault {
  method: string;
  path: string;
  latency_ms?: number;
  status?: number;
  code?: number;
  malformed?: boolean;
  times?: number;
}

export class MockApi {
  private readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  /**
   * Restores the seed data and the default latency, clears the faults, and
   * pauses automatic progress: a task's status changes only when a test calls
   * `advance`.
   */
  async reset() {
    await this.control("POST", "/__mock/reset", { paused: true });
  }

  async setFaults(faults: MockFault[]) {
    await this.control("PUT", "/__mock/faults", { faults });
  }

  /**
   * Advances the task by `steps` steps: pending → running 0% → +25% per step
   * → terminal status.
   */
  async advance(taskId: string, steps = 1) {
    for (let step = 0; step < steps; step += 1) {
      await this.control("POST", `/__mock/tasks/${taskId}/advance`);
    }
  }

  /**
   * The requests to the Mock API's business endpoints since the last reset;
   * `path` is the route pattern they matched, such as `/demo/tasks/:id`.
   */
  async requests(path?: string): Promise<{ method: string; url: string }[]> {
    const { requests } = await this.control("GET", "/__mock/requests");
    return requests.filter(
      (request: { path: string }) =>
        path === undefined || request.path === path,
    );
  }

  /** The business endpoints' current default latency, in milliseconds. */
  async latency(): Promise<number> {
    return (await this.control("GET", "/__mock/latency")).latency_ms;
  }

  /** Calls a business endpoint directly to set up data, bypassing the page. */
  async call(method: string, path: string, data?: unknown) {
    return this.control(method, path, data);
  }

  private async control(method: string, path: string, data?: unknown) {
    const response = await this.request.fetch(`${MOCK_API_URL}${path}`, {
      method,
      data,
    });
    expect(response.ok(), `${method} ${path}`).toBe(true);
    // A 204 has no body.
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
}

/** Resets the Mock API before every test, whether or not the test uses it. */
export const test = base.extend<{ mockApi: MockApi }>({
  mockApi: [
    async ({ request }, use) => {
      const mockApi = new MockApi(request);
      await mockApi.reset();
      await use(mockApi);
    },
    { auto: true },
  ],
});

/**
 * Navigates client-side from the current Data demo page to `url` through the
 * header's navigation. After a full page load, server-rendered controls
 * respond to clicks only once they hydrate; a client-side navigation renders
 * the whole page in the browser, with nothing left to hydrate, so the page can
 * be used as soon as it arrives. The header's in-progress badge is requested
 * only in the browser and sits in the same Suspense boundary as the navigation
 * links: once the badge shows, the links have hydrated and the click is a
 * client-side navigation.
 */
export async function navigateThroughHeader(
  page: Page,
  link: string,
  url: string,
) {
  await expect(page.getByLabel(/^进行中的任务 \d+ 个$/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Data demo 导航" })
    .getByRole("link", { name: link })
    .click();
  await expect(page).toHaveURL(url);
}

/**
 * Resets through the Fault lab's reset button, which besides the Mock API
 * also expires the Next server's task list cache. Pages that read the server
 * cache (All tasks, Gallery) use it when a test starts, so that they do not
 * read the cache the previous test left. The button is in the static shell,
 * and a click right after a full page load of the Fault lab can come before
 * hydration, so this enters through the header's navigation.
 */
export async function resetThroughLab(page: Page) {
  await page.goto("/demos/search");
  await navigateThroughHeader(page, "故障实验室", "/demos/lab");
  await page.getByRole("button", { name: "重置 Mock 数据" }).click();
  await expect(page.getByText("已重置")).toBeVisible();
}

export { expect };
