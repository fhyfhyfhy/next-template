import type { Page } from "@playwright/test";

import { expect, test } from "./mock-api";

// Search: requests as the user types, React Query owns the data, and the
// keyword only updates the URL shallowly.

const results = (page: Page) =>
  page.getByRole("list", { name: "搜索结果" }).getByRole("listitem");

test("a pause in typing puts the keyword in the URL and shows results, without a new history entry", async ({
  page,
}) => {
  await page.goto("/demos/tasks");
  await page.goto("/demos/search");
  const historyLength = await page.evaluate(() => history.length);

  // eslint-disable-next-line e2e/act-after-ready -- the search box reads useSearchParams and renders only in the browser, so finding it means the page has hydrated
  await page.getByLabel("搜索任务").pressSequentially("狐狸", { delay: 50 });

  await expect(page).toHaveURL(`/demos/search?q=${encodeURIComponent("狐狸")}`);
  await expect(results(page)).toHaveCount(3);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);

  await page.goBack();
  await expect(page).toHaveURL("/demos/tasks");
});

test("opening a link with a keyword restores the input and the results", async ({
  page,
}) => {
  await page.goto(`/demos/search?q=${encodeURIComponent("机甲")}`);

  await expect(page.getByLabel("搜索任务")).toHaveValue("机甲");
  await expect(results(page)).toHaveCount(3);
});

test("changing the keyword aborts the old request that has not returned", async ({
  page,
  mockApi,
}) => {
  await mockApi.setFaults([
    { method: "GET", path: "/demo/tasks/search", latency_ms: 1500 },
  ]);
  const aborted: string[] = [];
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/demo/tasks/search") {
      aborted.push(url.searchParams.get("term") ?? "");
    }
  });
  await page.goto("/demos/search");
  const input = page.getByLabel("搜索任务");

  // eslint-disable-next-line e2e/act-after-ready -- the search box reads useSearchParams and renders only in the browser, so finding it means the page has hydrated
  await input.fill("狐");
  await expect(page).toHaveURL(`/demos/search?q=${encodeURIComponent("狐")}`);
  await input.fill("狐狸");

  await expect(results(page)).toHaveCount(3);
  expect(aborted).toEqual(["狐"]);
});

test("the previous results stay until the new ones return", async ({
  page,
  mockApi,
}) => {
  await page.goto(`/demos/search?q=${encodeURIComponent("狐狸")}`);
  await expect(results(page)).toHaveCount(3);
  await mockApi.setFaults([
    { method: "GET", path: "/demo/tasks/search", latency_ms: 1500 },
  ]);

  await page.getByLabel("搜索任务").fill("跑车");

  await expect(page.getByText("更新中")).toBeVisible();
  await expect(results(page).first()).toContainText("狐狸");
  await expect(results(page).first()).toContainText("跑车");
});

test("clearing the keyword hides the results and the status", async ({
  page,
}) => {
  await page.goto(`/demos/search?q=${encodeURIComponent("狐狸")}`);
  await expect(results(page)).toHaveCount(3);

  await page.getByLabel("搜索任务").fill("");

  await expect(page).toHaveURL("/demos/search");
  await expect(results(page)).toHaveCount(0);
  await expect(page.getByText(/更新中|找到 \d+ 个任务|搜索中/)).toHaveCount(0);
});
