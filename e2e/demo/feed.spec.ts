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

/**
 * 经导航栏进入作品广场，等第一页出现。第一页的卡片在静态 shell 里，整页打开后立即点收藏可能早于 hydration；
 * 客户端导航（`navigateThroughHeader`）在浏览器里渲染整页，到达后就能操作。
 */
async function openFeed(page: Page) {
  await page.goto("/demos/search");
  await navigateThroughHeader(page, "作品广场", "/demos/feed");
  await expect(cards(page)).toHaveCount(6);
}

function feedRequests(page: Page) {
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/demo/feed")
      requests.push(request);
  });
  return requests;
}

test("第一页的卡片在服务端返回的 HTML 里，浏览器不再请求第一页", async ({
  page,
}) => {
  // 拦住应用的 JS 包，React 不会运行：卡片要是等浏览器渲染，这里只有骨架屏。
  const htmlPage = await page.context().newPage();
  await htmlPage.route("**/_next/static/**", (route) =>
    route.request().resourceType() === "script"
      ? route.abort()
      : route.continue(),
  );
  await htmlPage.goto("/demos/feed");
  await expect(cards(htmlPage)).toHaveCount(6);
  await expect(cards(htmlPage).first()).toContainText("多肉高模");
  await htmlPage.close();

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
  await openFeed(page);

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
  await openFeed(page);
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
  await openFeed(page);
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
  await openFeed(page);
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

test("加载到第二页后收藏第一页的作品，已加载的页不会被换掉", async ({
  page,
}) => {
  await openFeed(page);
  await page.getByTestId("feed-end").scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(12);
  const saved = page.waitForResponse(
    (response) => response.request().headers()["next-action"] !== undefined,
  );

  await cards(page)
    .filter({ hasText: "多肉高模" })
    .getByRole("button", { name: "收藏" })
    .click();
  await saved;

  // 已加载的页被换回第一页之后，第二页很快又会加载回来，只看最后的卡片数看不出来：
  // Server Action 带回页面之后的 2 秒里一直读卡片数，记下最小值。
  let fewest = await cards(page).count();
  const until = Date.now() + 2000;
  while (Date.now() < until) {
    fewest = Math.min(fewest, await cards(page).count());
  }
  // eslint-disable-next-line playwright/prefer-to-have-count -- fewest 是一段时间里的最小值，toHaveCount 只能断言当前的数量。
  expect(fewest).toBe(12);
});

test("收藏一个较早的作品，“我的收藏”里它直接出现在按创建时间排好的位置", async ({
  page,
  mockApi,
}) => {
  // 拖慢收藏请求：断言的是请求返回之前，乐观更新时的顺序。
  await mockApi.setFaults([
    { method: "PUT", path: "/demo/tasks/:id/favorite", latency_ms: 3000 },
  ]);
  await openFeed(page);
  await expect(favorites(page)).toHaveCount(4);

  await cards(page)
    .filter({ hasText: "长剑低模" })
    .getByRole("button", { name: "收藏" })
    .click();

  await expect(favorites(page)).toHaveText(
    ["薄荷绿跑车", "长剑低模", "木屋夜景", "重装机甲", "低多边形狐狸"],
    { timeout: 1000 },
  );
});
