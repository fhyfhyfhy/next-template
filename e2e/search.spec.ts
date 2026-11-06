import type { Page } from "@playwright/test";

import { delayRequests, hasPath } from "./browser";
import { expect, test } from "./test";

// 搜索：边输入边请求，数据由 React Query 负责；关键词只做 shallow URL 更新。

const results = (page: Page) =>
  page.getByRole("list", { name: "搜索结果" }).getByRole("listitem");

test("关键词随输入写进 URL 并显示结果，不新增历史记录", async ({ page }) => {
  await page.goto("/tasks");
  await page.goto("/search");
  const historyLength = await page.evaluate(() => history.length);

  // 搜索框在 hydration 之后才可用。
  await expect(page.getByLabel("搜索任务")).toBeEnabled();
  await page.getByLabel("搜索任务").pressSequentially("狐狸", { delay: 50 });

  await expect(page).toHaveURL(`/search?q=${encodeURIComponent("狐狸")}`);
  await expect(results(page)).toHaveCount(3);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);

  await page.goBack();
  await expect(page).toHaveURL("/tasks");
});

test("hydration 之前搜索框不可用，输入不会被 hydration 清掉", async ({
  page,
}) => {
  // 拦掉 JS bundle，页面停在 hydration 之前。
  await page.route(/\/_next\/static\/chunks\/.+\.js/, (route) => route.abort());
  await page.goto("/search");

  await expect(page.getByLabel("搜索任务")).toBeDisabled();
});

test("带关键词的链接打开时还原输入框和结果", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("机甲")}`);

  await expect(page.getByLabel("搜索任务")).toHaveValue("机甲");
  await expect(results(page)).toHaveCount(3);
});

const searchRequest = hasPath("/api/tasks/search");

test("换关键词时中止还没返回的旧请求", async ({ page }) => {
  await delayRequests(page, searchRequest, 1500);
  const aborted: string[] = [];
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/tasks/search") {
      aborted.push(url.searchParams.get("term") ?? "");
    }
  });
  await page.goto("/search");
  const input = page.getByLabel("搜索任务");
  // 关键词立即进 URL，请求要等输入停顿，所以等请求发出而不是等 URL。
  const firstRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/tasks/search" &&
      url.searchParams.get("term") === "狐"
    );
  });

  await expect(input).toBeEnabled();
  await input.fill("狐");
  await firstRequest;
  await input.fill("狐狸");

  await expect(results(page)).toHaveCount(3);
  expect(aborted).toEqual(["狐"]);
});

test("新结果返回前继续显示上一次的结果", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("狐狸")}`);
  await expect(results(page)).toHaveCount(3);
  await delayRequests(page, searchRequest, 1500);

  await page.getByLabel("搜索任务").fill("跑车");

  await expect(page.getByText("更新中")).toBeVisible();
  await expect(results(page).first()).toContainText("狐狸");
  await expect(results(page).first()).toContainText("跑车");
});

test("清空关键词后重新搜索，新结果返回前不显示清空前的结果", async ({
  page,
}) => {
  await page.goto(`/search?q=${encodeURIComponent("狐狸")}`);
  await expect(results(page)).toHaveCount(3);
  const input = page.getByLabel("搜索任务");
  await input.fill("");
  await expect(results(page)).toHaveCount(0);
  await delayRequests(page, searchRequest, 1500);

  await input.fill("跑车");

  await expect(page.getByText("搜索中…")).toBeVisible();
  await expect(results(page)).toHaveCount(0);
  await expect(results(page).first()).toContainText("跑车");
});

test("清空关键词后不再显示结果和状态", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("狐狸")}`);
  await expect(results(page)).toHaveCount(3);

  await page.getByLabel("搜索任务").fill("");

  await expect(page).toHaveURL("/search");
  await expect(results(page)).toHaveCount(0);
  await expect(page.getByText(/更新中|找到 \d+ 个任务|搜索中/)).toHaveCount(0);
});
