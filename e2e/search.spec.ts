import type { Page } from "@playwright/test";

import { expect, test } from "./mock-api";

// 搜索：边输入边请求，数据由 React Query 负责；关键词只做 shallow URL 更新。

const results = (page: Page) =>
  page.getByRole("list", { name: "搜索结果" }).getByRole("listitem");

test("输入停顿后把关键词写进 URL 并显示结果，不新增历史记录", async ({
  page,
}) => {
  await page.goto("/demos/tasks");
  await page.goto("/demos/search");
  const historyLength = await page.evaluate(() => history.length);

  await page.getByLabel("搜索任务").pressSequentially("狐狸", { delay: 50 });

  await expect(page).toHaveURL(`/demos/search?q=${encodeURIComponent("狐狸")}`);
  await expect(results(page)).toHaveCount(3);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);

  await page.goBack();
  await expect(page).toHaveURL("/demos/tasks");
});

test("带关键词的链接打开时还原输入框和结果", async ({ page }) => {
  await page.goto(`/demos/search?q=${encodeURIComponent("机甲")}`);

  await expect(page.getByLabel("搜索任务")).toHaveValue("机甲");
  await expect(results(page)).toHaveCount(3);
});

test("换关键词时中止还没返回的旧请求", async ({ page, mockApi }) => {
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

  await input.fill("狐");
  await expect(page).toHaveURL(`/demos/search?q=${encodeURIComponent("狐")}`);
  await input.fill("狐狸");

  await expect(results(page)).toHaveCount(3);
  expect(aborted).toEqual(["狐"]);
});

test("新结果返回前继续显示上一次的结果", async ({ page, mockApi }) => {
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
