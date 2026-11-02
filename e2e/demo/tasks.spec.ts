import { instant } from "@next/playwright";
import type { Page } from "@playwright/test";

import {
  expect,
  navigateThroughHeader,
  resetThroughLab,
  test,
} from "./mock-api";

// The All tasks page: a Server Component owns the data, and the filter, sort
// and page are all in the URL.

test.beforeEach(async ({ page }) => {
  await resetThroughLab(page);
});

const rows = (page: Page) =>
  page.getByRole("list", { name: "任务列表" }).getByRole("listitem");

/**
 * Enters the All tasks page from another Data demo page through the header's
 * navigation and waits for the list. On a full page load the list sits in its
 * own Suspense boundary and may hydrate later than the rest of the page: a
 * click before then can be lost, and a filter change also makes React drop
 * the server-rendered list and show the skeleton instead. A client-side
 * navigation (`navigateThroughHeader`) renders the whole page in the browser,
 * with nothing left to hydrate.
 */
async function openTasksPage(page: Page) {
  await page.goto("/demos/search");
  await navigateThroughHeader(page, "全部任务", "/demos/tasks");
  await expect(rows(page).first()).toBeVisible();
}

/** Clicks a status filter on the open All tasks page and waits for the new list. */
async function filterByStatus(page: Page, label: string, url: string) {
  await page
    .getByRole("navigation", { name: "按状态筛选" })
    .getByRole("link", { name: label })
    .click();
  await expect(page).toHaveURL(url);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/**
 * Goes to the Gallery and comes back with Back: on leaving, Next hides this
 * page with <Activity>, and on return it keeps its state and recreates its
 * effects.
 */
async function leaveAndReturn(page: Page) {
  await page
    .getByRole("navigation", { name: "Data demo 导航" })
    .getByRole("link", { name: "作品广场" })
    .click();
  await expect(page).toHaveURL("/demos/feed");
  await page.goBack();
  await expect(page).toHaveURL("/demos/tasks");
}

test("entering All tasks from the demos home shows the first page, newest first by default", async ({
  page,
}) => {
  await page.goto("/demos");
  // eslint-disable-next-line e2e/act-after-ready -- the home page has nothing rendered only in the browser to wait for; a click on the link before hydration navigates the full page, and the assertions below hold all the same
  await page.getByRole("link", { name: /全部任务/ }).click();

  await expect(page).toHaveURL("/demos/tasks");
  await expect(rows(page)).toHaveCount(8);
  await expect(rows(page).first()).toContainText("多肉高模");
});

test("the status filter goes into the URL, and Back returns to the previous filter", async ({
  page,
}) => {
  await openTasksPage(page);
  await page.getByRole("link", { name: "失败" }).click();

  await expect(page).toHaveURL("/demos/tasks?status=failed");
  await expect(rows(page)).toHaveCount(3);
  for (const row of await rows(page).all()) {
    await expect(row).toContainText("失败");
  }

  await page.goBack();
  await expect(page).toHaveURL("/demos/tasks");
  await expect(rows(page)).toHaveCount(8);
});

test("a filter change shows the new choice at once and marks the old list busy until the new one arrives", async ({
  page,
  mockApi,
}) => {
  await openTasksPage(page);
  // The list reads the Mock API on the server; slowing it down is what shows
  // the page before the new list arrives.
  await mockApi.setFaults([
    { method: "GET", path: "/demo/tasks", latency_ms: 2000 },
  ]);
  const failedTab = page
    .getByRole("navigation", { name: "按状态筛选" })
    .getByRole("link", { name: "失败" });
  const busyList = page
    .locator('[aria-busy="true"]')
    .getByRole("list", { name: "任务列表" });

  await failedTab.click();

  await expect(failedTab).toHaveAttribute("aria-current", "page");
  await expect(busyList).toBeVisible();
  await expect(page).toHaveURL("/demos/tasks");

  await expect(page).toHaveURL("/demos/tasks?status=failed");
  await expect(rows(page)).toHaveCount(3);
  await expect(busyList).toHaveCount(0);
});

test("sort and page go into the URL, and Back and Forward each show the matching data", async ({
  page,
}) => {
  await openTasksPage(page);
  await page.getByRole("combobox", { name: "排序" }).click();
  await page.getByRole("option", { name: "名称" }).click();
  await expect(page).toHaveURL("/demos/tasks?sort=name_asc");
  const firstByName = await rows(page).first().textContent();

  await page.getByRole("link", { name: "下一页" }).click();
  await expect(page).toHaveURL("/demos/tasks?sort=name_asc&page=2");
  await expect(rows(page).first()).not.toHaveText(firstByName ?? "");

  await page.goBack();
  await expect(rows(page).first()).toHaveText(firstByName ?? "");
  await page.goForward();
  await expect(page).toHaveURL("/demos/tasks?sort=name_asc&page=2");
});

test("the list's skeleton is in the static shell, and the data streams in after it", async ({
  page,
  baseURL,
}) => {
  // Inside instant()'s scope, everything that renders only at request time is
  // held back, so the page stays at the static shell.
  await instant(
    page,
    async () => {
      await page.goto("/demos/tasks?status=done");
      await expect(page.getByTestId("task-list-skeleton")).toBeVisible();
      await expect(rows(page)).toHaveCount(0);
    },
    { baseURL },
  );

  await expect(rows(page).first()).toBeVisible();
});

test("the list reads the server cache: after the backend data changes, it shows the snapshot while the cache lasts", async ({
  page,
  mockApi,
}) => {
  await page.goto("/demos/tasks?status=failed");
  await expect(rows(page)).toHaveCount(3);

  await mockApi.call("PATCH", "/demo/tasks/task-05", { name: "后台改名" });
  await page.reload();

  await expect(rows(page).filter({ hasText: "后台改名" })).toHaveCount(0);
});

test("creating a task shows it in the list at once and clears the form", async ({
  page,
}) => {
  await openTasksPage(page);
  await page.getByLabel("名称").fill("新建的跑车");
  await page.getByLabel("Prompt").fill("一辆红色跑车");
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(rows(page).first()).toContainText("新建的跑车");
  await expect(rows(page).first()).toContainText("排队中");
  await expect(page.getByLabel("名称")).toHaveValue("");
});

// The page checks the in-progress tasks every 3 s and reads the list again
// when they change, so waiting for the list to catch up needs more than the
// default 5 s.
const untilPolled = { timeout: 10_000 };

test("staying on the list, a new task advances all the way to done, and the header's in-progress count follows", async ({
  page,
  mockApi,
}) => {
  await openTasksPage(page);
  await page.getByLabel("名称").fill("推进中的任务");
  await page.getByLabel("Prompt").fill("一只狐狸");
  await page.getByRole("button", { name: "创建任务" }).click();
  const row = rows(page).filter({ hasText: "推进中的任务" });
  await expect(row).toContainText("排队中");
  // The seed has 4 other tasks in progress; with the clock paused, they never
  // change.
  await expect(page.getByLabel("进行中的任务 5 个")).toBeVisible();

  const href = await row.getByRole("link").getAttribute("href");
  const taskId = href?.split("/").at(-1) ?? "";
  await mockApi.advance(taskId);
  await expect(row).toContainText("生成中", untilPolled);

  await mockApi.advance(taskId, 5);
  await expect(row).toContainText("已完成", untilPolled);
  await expect(page.getByLabel("进行中的任务 4 个")).toBeVisible();
});

test("staying on the running filter, a task that finishes leaves the list and the total drops", async ({
  page,
  mockApi,
}) => {
  await page.goto("/demos/tasks?status=running");
  const finishing = rows(page).filter({ hasText: "复古跑车 v3" });
  await expect(finishing).toContainText("生成中");
  await expect(page.getByText("共 2 个任务")).toBeVisible();

  // Running tasks in the seed are at 50%; 3 more steps reach the terminal
  // status.
  await mockApi.advance("task-16", 3);

  await expect(finishing).toHaveCount(0, untilPolled);
  await expect(page.getByText("共 1 个任务")).toBeVisible();
});

test("staying on the done filter, a task that finishes elsewhere shows up in the list", async ({
  page,
  mockApi,
}) => {
  await page.goto("/demos/tasks?status=done");
  await expect(rows(page).first()).toBeVisible();
  await expect(rows(page).filter({ hasText: "复古跑车 v3" })).toHaveCount(0);

  await mockApi.advance("task-16", 3);

  await expect(rows(page).filter({ hasText: "复古跑车 v3" })).toContainText(
    "已完成",
    untilPolled,
  );
});

test("the create form is disabled before hydration", async ({ page }) => {
  // With the JS bundles aborted, the page stays unhydrated.
  await page.route(/\/_next\/static\/chunks\/.+\.js/, (route) => route.abort());
  await page.goto("/demos/tasks");

  await expect(page.getByLabel("名称")).toBeDisabled();
  await expect(page.getByLabel("Prompt")).toBeDisabled();
  await expect(page.getByRole("button", { name: "创建任务" })).toBeDisabled();
});

test("a taken name on create shows the error under the name field, with no global toast", async ({
  page,
}) => {
  await openTasksPage(page);
  await page.getByLabel("名称").fill("低多边形狐狸");
  await page.getByLabel("Prompt").fill("一只狐狸");
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(page.getByText("名称已被其他任务占用")).toBeVisible();
  await expect(page.getByText("请求失败，请稍后重试")).toHaveCount(0);

  await page.getByLabel("名称").fill("低多边形狐狸 2");
  await expect(page.getByText("名称已被其他任务占用")).toHaveCount(0);
});

test("after a successful create, submitting a taken name still shows the error under the name field", async ({
  page,
}) => {
  await openTasksPage(page);
  await page.getByLabel("名称").fill("新建的跑车");
  await page.getByLabel("Prompt").fill("一辆红色跑车");
  await page.getByRole("button", { name: "创建任务" }).click();
  await expect(rows(page).first()).toContainText("新建的跑车");
  await expect(page.getByLabel("名称")).toHaveValue("");

  await page.getByLabel("名称").fill("新建的跑车");
  await page.getByLabel("Prompt").fill("另一辆红色跑车");
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(page.getByText("名称已被其他任务占用")).toBeVisible();
});

test("leaving a half-filled form and coming back keeps the input, which still submits", async ({
  page,
}) => {
  await openTasksPage(page);
  await page.getByLabel("名称").fill("离开再回来");

  await leaveAndReturn(page);

  await expect(page.getByLabel("名称")).toHaveValue("离开再回来");
  await page.getByLabel("Prompt").fill("一只狐狸");
  await page.getByRole("button", { name: "创建任务" }).click();
  await expect(rows(page).first()).toContainText("离开再回来");
});

test("a name edited after a taken-name error stays edited after leaving and coming back", async ({
  page,
}) => {
  await openTasksPage(page);
  await page.getByLabel("名称").fill("低多边形狐狸");
  await page.getByLabel("Prompt").fill("一只狐狸");
  await page.getByRole("button", { name: "创建任务" }).click();
  await expect(page.getByText("名称已被其他任务占用")).toBeVisible();
  await page.getByLabel("名称").fill("改过的名字");

  await leaveAndReturn(page);

  await expect(page.getByLabel("名称")).toHaveValue("改过的名字");
  await expect(page.getByText("名称已被其他任务占用")).toHaveCount(0);
});

test("an empty name is stopped in the browser, with no request sent", async ({
  page,
}) => {
  await openTasksPage(page);
  let created = false;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/demos/tasks"))
      created = true;
  });
  await page.getByLabel("Prompt").fill("一只狐狸");
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(page.getByText("请输入名称")).toBeVisible();
  expect(created).toBe(false);
});

test("a failed create shows the global toast and keeps the input, and a retry succeeds", async ({
  page,
  mockApi,
}) => {
  await mockApi.setFaults([
    { method: "POST", path: "/demo/tasks", status: 500 },
  ]);
  await openTasksPage(page);
  await page.getByLabel("名称").fill("出错的任务");
  await page.getByLabel("Prompt").fill("一只狐狸");
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(page.getByText("请求失败，请稍后重试")).toHaveCount(1);
  await expect(page.getByLabel("名称")).toHaveValue("出错的任务");
  await expect(page.getByLabel("Prompt")).toHaveValue("一只狐狸");

  await mockApi.setFaults([]);
  await page.getByRole("button", { name: "创建任务" }).click();
  await expect(rows(page).first()).toContainText("出错的任务");
});

test("favoriting takes effect at once, showing as favorited before the request completes", async ({
  page,
  mockApi,
}) => {
  await mockApi.setFaults([
    { method: "PUT", path: "/demo/tasks/:id/favorite", latency_ms: 1500 },
  ]);
  await openTasksPage(page);
  await filterByStatus(page, "失败", "/demos/tasks?status=failed");
  const star = rows(page).first().getByRole("button", { name: "收藏" });
  // Favoriting goes through a Server Action; when it returns, the backend has
  // written.
  const saved = page.waitForResponse(
    (response) => response.request().headers()["next-action"] !== undefined,
  );

  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");

  await saved;
  await page.reload();
  await expect(
    rows(page).first().getByRole("button", { name: "收藏" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("a failed favorite puts the star back and shows a single global toast", async ({
  page,
  mockApi,
}) => {
  await mockApi.setFaults([
    { method: "PUT", path: "/demo/tasks/:id/favorite", status: 500 },
  ]);
  await openTasksPage(page);
  await filterByStatus(page, "失败", "/demos/tasks?status=failed");
  const star = rows(page).first().getByRole("button", { name: "收藏" });

  await star.click();

  await expect(page.getByText("请求失败，请稍后重试")).toHaveCount(1);
  await expect(star).toHaveAttribute("aria-pressed", "false");
});

test("a detail link is prefetched once it enters the viewport", async ({
  page,
}) => {
  // In a production build, a Link prefetches its route when it enters the
  // viewport; the dev server does not prefetch.
  const prefetchedPaths: string[] = [];
  page.on("request", (request) => {
    if (request.headers()["next-router-prefetch"] === "1")
      prefetchedPaths.push(new URL(request.url()).pathname);
  });
  await page.goto("/demos/tasks");

  await expect
    .poll(() =>
      prefetchedPaths.some((path) => path.startsWith("/demos/tasks/task-")),
    )
    .toBe(true);
});

test("opening a detail shows the prefetched skeleton at once, and the detail arrives after it", async ({
  page,
}) => {
  await openTasksPage(page);
  const link = rows(page).first().getByRole("link");
  const name = (await link.textContent()) ?? "";

  // Inside the scope only what was prefetched can render: without the prefetch
  // the navigation cannot commit, and waiting for the URL times out.
  await instant(page, async () => {
    await link.click();
    await page.waitForURL(/\/demos\/tasks\/task-/);
    await expect(page.getByTestId("task-detail-skeleton")).toBeVisible();
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(
      0,
    );
  });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
});

test("Back from a detail returns to the same filter and page", async ({
  page,
}) => {
  await openTasksPage(page);
  await filterByStatus(page, "已完成", "/demos/tasks?status=done");
  await page.getByRole("link", { name: "下一页" }).click();
  await expect(page).toHaveURL("/demos/tasks?status=done&page=2");
  const link = rows(page).first().getByRole("link");
  const name = await link.textContent();

  await link.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name ?? "");

  await page.goBack();
  await expect(page).toHaveURL("/demos/tasks?status=done&page=2");
  await expect(rows(page).first().getByRole("link")).toHaveText(name ?? "");
});
