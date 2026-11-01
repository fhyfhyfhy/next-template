import type { Page, Request } from "@playwright/test";

import {
  expect,
  navigateThroughHeader,
  resetThroughLab,
  test,
} from "./mock-api";

// The Gallery: infinite scroll owned by React Query, with its first page from
// a snapshot in the server cache.

test.beforeEach(async ({ page }) => {
  await resetThroughLab(page);
});

const cards = (page: Page) =>
  page.getByRole("list", { name: "作品" }).getByRole("listitem");
const favorites = (page: Page) =>
  page.getByRole("list", { name: "我的收藏" }).getByRole("listitem");

/**
 * Enters the Gallery through the header's navigation and waits for the first
 * page. The first page's cards are in the static shell, so a favorite clicked
 * right after a full page load can come before hydration; a client-side
 * navigation (`navigateThroughHeader`) renders the whole page in the browser,
 * ready to use once it arrives.
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

test("the first page's cards are in the server's HTML, and the browser does not request the first page again", async ({
  page,
}) => {
  // With the app's JS aborted, React never runs: if the cards waited for the
  // browser to render them, there would be only the skeleton here.
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
  // eslint-disable-next-line playwright/no-wait-for-timeout -- asserts that the first page is not requested for a while; the wait is part of the assertion
  await page.waitForTimeout(500);

  expect(
    requests.map((item) => new URL(item.url()).searchParams.get("page")),
  ).not.toContain("1");
});

test("scrolling to the bottom loads the next page, until there are no more", async ({
  page,
}) => {
  await openFeed(page);

  await page.getByTestId("feed-end").scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(12);
  await page.getByTestId("feed-end").scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(13);
  await expect(page.getByText("没有更多作品了")).toBeVisible();
});

test('favoriting updates the card and "My favorites" together, at once', async ({
  page,
  mockApi,
}) => {
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

test('a failed favorite rolls back the card and "My favorites" together, with a single global toast', async ({
  page,
  mockApi,
}) => {
  await mockApi.setFaults([
    { method: "PUT", path: "/demo/tasks/:id/favorite", status: 500 },
  ]);
  await openFeed(page);
  await expect(favorites(page)).toHaveCount(4);
  // A work on the first page that is already a favorite: after a failed
  // unfavorite it must still be one.
  const card = cards(page).filter({ hasText: "薄荷绿跑车" });

  await card.getByRole("button", { name: "收藏" }).click();

  await expect(page.getByText("请求失败，请稍后重试")).toHaveCount(1);
  await expect(card.getByRole("button", { name: "收藏" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(favorites(page)).toHaveCount(4);
});

test("a favorite made in the Gallery shows on the list page at once", async ({
  page,
}) => {
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

test('after favoriting on All tasks, back in the Gallery the card and "My favorites" are both updated', async ({
  page,
}) => {
  // Client-side navigation throughout: the browser's React Query cache stays,
  // which is exactly when it could show stale favorites.
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

test("favoriting a first-page work after the second page loads does not replace the loaded pages", async ({
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

  // Were the loaded pages replaced by the first page alone, the second would
  // soon load again, and the final card count would not show it: read the
  // count throughout the 2 s after the Server Action brings the page back, and
  // keep the minimum.
  let fewest = await cards(page).count();
  const until = Date.now() + 2000;
  while (Date.now() < until) {
    fewest = Math.min(fewest, await cards(page).count());
  }
  // eslint-disable-next-line playwright/prefer-to-have-count -- fewest is the minimum over a period, and toHaveCount can only assert the current count
  expect(fewest).toBe(12);
});

test('favoriting an older work puts it straight into its place by creation time in "My favorites"', async ({
  page,
  mockApi,
}) => {
  // The favorite request is slowed down: the assertion is on the optimistic
  // order, before the request returns.
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
