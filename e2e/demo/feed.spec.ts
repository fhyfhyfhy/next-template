import type { Page, Request } from "@playwright/test";

import {
  expect,
  navigateThroughHeader,
  resetThroughLab,
  test,
} from "./mock-api";

// 作品广场：React Query 负责的无限滚动，第一页来自服务端缓存的快照。

test.beforeEach(async ({ page }) => {
  await resetThroughLab(page);
});

const cards = (page: Page) =>
  page.getByRole("list", { name: "作品" }).getByRole("listitem");
const favorites = (page: Page) =>
  page.getByRole("list", { name: "我的收藏" }).getByRole("listitem");

function feedRequests(page: Page) {
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/demo/feed")
      requests.push(request);
  });
  return requests;
}

test("第一页随页面一起送达，浏览器不再请求第一页", async ({
  page,
  request,
}) => {
  const html = await (await request.get("/demos/feed")).text();
  expect(html).toContain("多肉高模");

  const requests = feedRequests(page);
  await page.goto("/demos/feed");
  await expect(cards(page)).toHaveCount(6);
  // eslint-disable-next-line playwright/no-wait-for-timeout -- 断言一段时间内没有请求第一页，等待是断言的一部分。
  await page.waitForTimeout(500);

  expect(
    requests.map((item) => new URL(item.url()).searchParams.get("page")),
  ).not.toContain("1");
});

test("滚动到底部时加载下一页，直到没有更多", async ({ page }) => {
  await page.goto("/demos/feed");
  await expect(cards(page)).toHaveCount(6);

  await page.getByTestId("feed-end").scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(12);
  await page.getByTestId("feed-end").scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(13);
  await expect(page.getByText("没有更多作品了")).toBeVisible();
});

test("收藏时卡片和“我的收藏”同时立即更新", async ({ page, mockApi }) => {
  await mockApi.setFaults([
    { method: "PUT", path: "/demo/tasks/:id/favorite", latency_ms: 1500 },
  ]);
  await page.goto("/demos/feed");
  await expect(favorites(page)).toHaveCount(4);
  const card = cards(page).filter({ hasText: "多肉高模" });

  await card.getByRole("button", { name: "收藏" }).click();

  await expect(card.getByRole("button", { name: "收藏" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(favorites(page)).toHaveCount(5);
  await expect(favorites(page).first()).toContainText("多肉高模");
});

test("收藏失败时卡片和“我的收藏”一起回滚，只弹一个全局提示", async ({
  page,
  mockApi,
}) => {
  await mockApi.setFaults([
    { method: "PUT", path: "/demo/tasks/:id/favorite", status: 500 },
  ]);
  await page.goto("/demos/feed");
  await expect(favorites(page)).toHaveCount(4);
  // 第一页里已收藏的作品：取消收藏失败后应当仍是已收藏。
  const card = cards(page).filter({ hasText: "薄荷绿跑车" });

  await card.getByRole("button", { name: "收藏" }).click();

  await expect(page.getByText("请求失败，请稍后重试")).toHaveCount(1);
  await expect(card.getByRole("button", { name: "收藏" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(favorites(page)).toHaveCount(4);
});

test("在作品广场收藏后，列表页立即显示已收藏", async ({ page }) => {
  await page.goto("/demos/feed");
  const card = cards(page).filter({ hasText: "多肉高模" });
  await card.getByRole("button", { name: "收藏" }).click();
  await expect(favorites(page)).toHaveCount(5);

  await page.goto("/demos/tasks?status=done");
  const row = page.getByRole("listitem").filter({ hasText: "多肉高模" });
  await expect(row.getByRole("button", { name: "收藏" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("在全部任务页收藏后回到作品广场，卡片和“我的收藏”都已更新", async ({
  page,
}) => {
  // 全程客户端导航：浏览器里的 React Query 缓存一直保留，这正是它可能显示旧收藏的情形。
  await page.goto("/demos/search");
  await navigateThroughHeader(page, "作品广场", "/demos/feed");
  await expect(favorites(page)).toHaveCount(4);
  await navigateThroughHeader(page, "全部任务", "/demos/tasks");
  const row = page
    .getByRole("list", { name: "任务列表" })
    .getByRole("listitem")
    .filter({ hasText: "多肉高模" });
  const saved = page.waitForResponse(
    (response) => response.request().headers()["next-action"] !== undefined,
  );
  await row.getByRole("button", { name: "收藏" }).click();
  await saved;

  await navigateThroughHeader(page, "作品广场", "/demos/feed");
  await expect(
    cards(page)
      .filter({ hasText: "多肉高模" })
      .getByRole("button", { name: "收藏" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(favorites(page)).toHaveCount(5);
  await expect(favorites(page).first()).toContainText("多肉高模");
});
