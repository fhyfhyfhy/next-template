import type { Locator, Page } from "@playwright/test";

import { expect, resetThroughLab, test } from "./mock-api";

// The Fault lab: inject faults, and watch the toasts, retries and error
// boundaries when requests fail.

const GLOBAL_ERROR_TOAST = "请求失败，请稍后重试";

const section = (page: Page, name: string) =>
  page.getByRole("region", { name });

async function choose(page: Page, combobox: Locator, option: string) {
  await combobox.click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await resetThroughLab(page);
});

test("faults injected from the fault panel apply to other pages, and a failed server render shows error.tsx", async ({
  page,
}) => {
  const panel = section(page, "注入故障");
  await choose(
    page,
    panel.getByRole("combobox", { name: "接口" }),
    "GET /demo/tasks",
  );
  await choose(page, panel.getByRole("combobox", { name: "故障" }), "返回 5xx");
  await choose(page, panel.getByRole("combobox", { name: "次数" }), "一直生效");
  await panel.getByRole("button", { name: "添加故障" }).click();
  await expect(panel.getByRole("listitem")).toHaveCount(1);

  await page.goto("/demos/tasks");
  await expect(
    page.getByRole("heading", { name: "页面加载失败" }),
  ).toBeVisible();

  await page.goto("/demos/lab");
  // eslint-disable-next-line e2e/act-after-ready -- the clear-all button renders only once the browser has read the fault config, so finding it means the page has hydrated
  await section(page, "注入故障")
    .getByRole("button", { name: "清除全部" })
    .click();
  // Wait for the clear to take effect before leaving: leaving the page cancels
  // a request still on its way, which leaves the faults in place and the list
  // page still failing.
  await expect(
    section(page, "注入故障").getByText("当前没有故障"),
  ).toBeVisible();
  await page.goto("/demos/tasks");
  await expect(page.getByRole("list", { name: "任务列表" })).toBeVisible();
});

test("the fault panel changes the default latency, and resetting the mock data restores it", async ({
  page,
  mockApi,
}) => {
  const latency = section(page, "注入故障").getByRole("combobox", {
    name: "默认延迟",
  });
  await expect(latency).toHaveText("500ms");

  await choose(page, latency, "2000ms");
  await expect.poll(() => mockApi.latency()).toBe(2000);
  await expect(latency).toHaveText("2000ms");

  await page.getByRole("button", { name: "重置 Mock 数据" }).click();
  await expect(latency).toHaveText("500ms");
  expect(await mockApi.latency()).toBe(500);
});

test("a failed first load renders the error; a failed refresh with data keeps the data and shows a toast", async ({
  page,
}) => {
  const demo = section(page, "首次加载和刷新失败");

  await demo.getByRole("button", { name: "首次加载（会失败）" }).click();
  await expect(demo.getByText("加载失败")).toBeVisible();
  await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(0);

  await demo.getByRole("button", { name: "首次加载（会成功）" }).click();
  await expect(demo.getByText("低多边形狐狸")).toBeVisible();

  await demo.getByRole("button", { name: "刷新（会失败）" }).click();
  await expect(page.getByText(GLOBAL_ERROR_TOAST)).toBeVisible();
  await expect(demo.getByText("低多边形狐狸")).toBeVisible();
});

test("5xx is retried; 4xx, an error on a 2xx, and a schema mismatch are not", async ({
  page,
}) => {
  const demo = section(page, "重试规则");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  // The retries wait 1, 2 and 4 s, React Query's default exponential backoff.
  test.setTimeout(30_000);
  await demo.getByRole("button", { name: "5xx 两次后恢复" }).click();
  await expect(
    demo.getByText("5xx 两次后恢复：成功，失败 2 次后重试成功"),
  ).toBeVisible({ timeout: 10_000 });

  await demo.getByRole("button", { name: "5xx 一直失败" }).click();
  await expect(demo.getByText("5xx 一直失败：失败，重试了 3 次")).toBeVisible({
    timeout: 15_000,
  });

  await demo.getByRole("button", { name: "4xx" }).click();
  await expect(demo.getByText("4xx：失败，没有重试")).toBeVisible();

  await demo.getByRole("button", { name: "2xx 返回 error" }).click();
  await expect(demo.getByText("2xx 返回 error：失败，没有重试")).toBeVisible();

  await demo.getByRole("button", { name: "schema 不匹配" }).click();
  await expect(demo.getByText("schema 不匹配：失败，没有重试")).toBeVisible();
  await expect
    .poll(() => consoleErrors.join("\n"))
    .toContain("SchemaValidationError");
});

test("several requests failing at once show a single toast", async ({
  page,
}) => {
  const demo = section(page, "同时失败");
  await expect(demo.getByRole("listitem")).toHaveCount(3);

  await demo.getByRole("button", { name: "同时刷新（都会失败）" }).click();

  await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(1);
  // eslint-disable-next-line playwright/no-wait-for-timeout -- asserts that no second toast appears for a while; the wait is part of the assertion
  await page.waitForTimeout(500);
  await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(1);
});

/**
 * Opens the Fault lab and waits for it to hydrate: the fault list is requested
 * only in the browser, in the same Suspense boundary as the Draft Mode switch.
 */
async function openLab(page: Page) {
  await page.goto("/demos/lab");
  await expect(
    section(page, "注入故障").getByText("当前没有故障"),
  ).toBeVisible();
}

/**
 * Clicks the switch and waits for the Server Action to return: the switch
 * shows the new state optimistically first, and the cookie is set only by the
 * action's response.
 */
async function toggleDraftMode(page: Page, checked: boolean) {
  const draft = section(page, "跳过服务端缓存").getByRole("switch", {
    name: "Draft Mode",
  });
  const saved = page.waitForResponse(
    (response) => response.request().headers()["next-action"] !== undefined,
  );
  await draft.click();
  await saved;
  await expect(draft).toBeChecked({ checked });
}

test("Draft Mode on bypasses the server cache, and turning it off brings the cache back", async ({
  page,
  mockApi,
}) => {
  const rows = page
    .getByRole("list", { name: "任务列表" })
    .getByRole("listitem");
  await page.goto("/demos/tasks?status=failed");
  await expect(rows).toHaveCount(3);

  // The cache holds the snapshot from before the rename; without Draft Mode a
  // reload still shows it (the server cache test in tasks.spec.ts).
  await mockApi.call("PATCH", "/demo/tasks/task-05", { name: "开启后改名" });
  await openLab(page);
  await toggleDraftMode(page, true);
  await page.goto("/demos/tasks?status=failed");
  await expect(rows.filter({ hasText: "开启后改名" })).toHaveCount(1);

  await openLab(page);
  await expect(
    section(page, "跳过服务端缓存").getByRole("switch", { name: "Draft Mode" }),
  ).toBeChecked();
  await toggleDraftMode(page, false);

  // Reads under Draft Mode do not write the cache, so once it is off the page
  // reads the snapshot cached before it was on, and later changes too wait for
  // the cache to refresh.
  await mockApi.call("PATCH", "/demo/tasks/task-05", { name: "关闭后改名" });
  await page.goto("/demos/tasks?status=failed");
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: "关闭后改名" })).toHaveCount(0);
});

test("a failed Suspense query reaches the error boundary, and a retry after the reset succeeds", async ({
  page,
}) => {
  const demo = section(page, "错误边界和重置");

  await demo.getByRole("button", { name: "加载（第一次会失败）" }).click();
  await expect(demo.getByRole("alert")).toContainText("加载失败");

  await demo.getByRole("button", { name: "重试" }).click();
  await expect(demo.getByText("重装机甲")).toBeVisible();
});
