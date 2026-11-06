import type { Page } from "@playwright/test";

import { unique } from "./backend";
import {
  failRequests,
  hasPath,
  isServerAction,
  openWithoutScripts,
  recordRequests,
  waitForServerAction,
} from "./browser";
import {
  createTaskThroughForm,
  expect,
  filterByStatus,
  isActiveTasksRequest,
  navigateThroughHeader,
  openTasksPage,
  type TaskData,
  taskRow,
  test,
  untilPolled,
} from "./tasks";

// 作品广场：React Query 负责的无限滚动，第一页来自服务端缓存的快照。快照里是所有已完成的任务，别的用例完成的
// 任务也会排在前面：断言只看自己的任务，或者不依赖具体是哪些作品。

// 第一页要高过一屏：滚动之前看不到底部的哨兵，下一页等用例滚到底才加载。
test.use({ viewport: { width: 1280, height: 600 } });

const cards = (page: Page) =>
  page.getByRole("list", { name: "作品" }).getByRole("listitem");
const favorites = (page: Page) =>
  page.getByRole("list", { name: "我的收藏" }).getByRole("listitem");
const star = (page: Page, name: string) =>
  cards(page).filter({ hasText: name }).getByRole("button", { name: "收藏" });

/**
 * 先刷新快照（`refreshFeedSnapshot`），再经导航栏进入作品广场，等第一页出现。第一页的卡片在静态 shell 里，整页
 * 打开后立即点收藏可能早于 hydration；客户端导航在浏览器里渲染整页，到达后就能操作。
 */
async function openFeed(page: Page) {
  await refreshFeedSnapshot(page);
  await navigateThroughHeader(page, "作品广场", "/feed");
  await expect(cards(page)).toHaveCount(6);
}

/**
 * 在全部任务页用表单建一个任务，停在全部任务页。这次写入经 Server Action 让任务列表的缓存失效，作品广场的快照
 * 随之重新读取，时间戳是新的：之后打开作品广场时，浏览器不会因为快照过期而重新请求第一页，快照里也是库里的最新数据。
 */
async function refreshFeedSnapshot(page: Page) {
  await openTasksPage(page);
  await createTaskThroughForm(page);
}

/**
 * 在全部任务页建一个任务，停在页面上等它生成完成。页面发现任务结束后让列表缓存失效，作品广场的快照也随之重新读取。
 * 之后在同一个页面里经导航栏进作品广场（`enterFeedWithNewWork`），这个任务作为最新完成的作品排在第一页。
 */
async function finishNewWork(page: Page, tasks: TaskData) {
  await openTasksPage(page);
  const task = await createTaskThroughForm(page, unique("新作品"));
  await tasks.reportProgress(task.id, {
    status: "done",
    progress: 100,
    log: "生成完成",
  });
  await expect(taskRow(page, task.name)).toContainText("已完成", untilPolled);
  return task.name;
}

async function enterFeedWithNewWork(page: Page, name: string) {
  await navigateThroughHeader(page, "作品广场", "/feed");
  await expect(cards(page).first()).toContainText(name);
}

async function openFeedWithNewWork(page: Page, tasks: TaskData) {
  const name = await finishNewWork(page, tasks);
  await enterFeedWithNewWork(page, name);
  return name;
}

/** “我的收藏”加载完之后列出的作品名。它在自己的 Suspense 里，可能比作品晚到；种子数据里就有收藏，列表不会是空的。 */
async function favoriteNames(page: Page) {
  await expect(favorites(page).first()).toBeVisible();
  return favorites(page).allTextContents();
}

/** 第一页里还没收藏的作品名，按页面上的顺序。卡片的文字就是任务名。 */
function unfavoritedCards(page: Page) {
  return cards(page)
    .filter({
      has: page.getByRole("button", { name: "收藏", pressed: false }),
    })
    .getByRole("link")
    .allTextContents();
}

test("第一页的卡片在服务端返回的 HTML 里，浏览器不再请求第一页", async ({
  page,
}) => {
  await refreshFeedSnapshot(page);
  // React 不运行：卡片要是等浏览器渲染，这里只有骨架屏。
  const htmlPage = await openWithoutScripts(page, "/feed");
  await expect(cards(htmlPage)).toHaveCount(6);
  await htmlPage.close();

  const requests = recordRequests(page, hasPath("/api/feed"));
  // header 徽标的轮询只在浏览器里运行：它发出请求时页面已经 hydrate，计时从这之后开始。
  const polled = page.waitForRequest(isActiveTasksRequest);
  await page.goto("/feed");
  await expect(cards(page)).toHaveCount(6);
  await polled;
  // eslint-disable-next-line playwright/no-wait-for-timeout -- 断言一段时间内没有请求第一页，等待是断言的一部分。
  await page.waitForTimeout(500);

  // 第一页的请求不带游标。
  expect(
    requests.filter((item) => !new URL(item.url()).searchParams.has("cursor")),
  ).toStrictEqual([]);
});

test("翻页期间有任务完成、排进第一页的范围，下一页也不重复已显示的作品", async ({
  page,
  tasks,
}) => {
  await openFeed(page);
  // 在第一页前两个作品之间插入一个生成中的任务，再让它完成：按页码翻页的话，下一页会重复第一页最后一个作品。
  const shown = await cards(page).allTextContents();
  const [newer = 0, older = 0] = [
    ...(await tasks.createdAt(shown.slice(0, 2))).values(),
  ].sort((a, b) => b - a);
  const task = await tasks.createTask({
    status: "running",
    progress: 75,
    createdAt: new Date((newer + older) / 2),
  });
  await tasks.reportProgress(task.id, {
    status: "done",
    progress: 100,
    log: "生成完成",
  });

  await page.getByTestId("feed-end").scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(12);
  const names = await cards(page).allTextContents();
  expect(names.slice(0, 6)).toStrictEqual(shown);
  expect(new Set(names).size).toBe(names.length);
});

test("滚动到底部时逐页加载，直到列出全部已完成的作品", async ({
  page,
  tasks,
}) => {
  // 快照是新的，第一页和库里一致，之后的页由浏览器请求：最后列出的作品数应当等于库里已完成的任务数。
  await refreshFeedSnapshot(page);
  await navigateThroughHeader(page, "作品广场", "/feed");
  await expect(cards(page)).toHaveCount(6);
  const total = await tasks.countDone();
  const end = page.getByText("没有更多作品了");

  await page.getByTestId("feed-end").scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(12);
  // 一页 6 个，一直滚到最后一页。
  await expect(async () => {
    await page.getByTestId("feed-end").scrollIntoViewIfNeeded();
    await expect(end).toBeVisible({ timeout: 1000 });
  }).toPass();

  const names = await cards(page).allTextContents();
  expect(names).toHaveLength(total);
  expect(new Set(names).size).toBe(names.length);
});

test("收藏时卡片和“我的收藏”同时立即更新", async ({ page }) => {
  await openFeed(page);
  const count = (await favoriteNames(page)).length;
  const name = (await unfavoritedCards(page)).at(-1) ?? "";
  // 让收藏请求晚 1.5 秒才失败：断言的是返回之前的乐观更新，失败后收藏回滚，不留下数据。
  await failRequests(page, isServerAction, { delayMs: 1500 });

  await star(page, name).click();

  await expect(star(page, name)).toHaveAttribute("aria-pressed", "true");
  await expect(favorites(page)).toHaveCount(count + 1);
  await expect(favorites(page).filter({ hasText: name })).toHaveCount(1);
});

test("收藏失败时卡片和“我的收藏”一起回滚，只弹一个全局提示", async ({
  page,
}) => {
  await openFeed(page);
  const count = (await favoriteNames(page)).length;
  const name = (await unfavoritedCards(page)).at(-1) ?? "";
  await failRequests(page, isServerAction);

  await star(page, name).click();

  await expect(page.getByText("更新收藏失败，请稍后重试")).toHaveCount(1);
  await expect(star(page, name)).toHaveAttribute("aria-pressed", "false");
  await expect(favorites(page)).toHaveCount(count);
});

test("取消收藏时卡片和“我的收藏”立即更新，失败后一起恢复", async ({
  page,
  tasks,
}) => {
  // 自己建一个已收藏的作品：它最新，排在第一页最前面，也在“我的收藏”里。
  const { name } = await tasks.createTask({ status: "done", favorite: true });
  await openFeed(page);
  await expect(cards(page).first()).toContainText(name);
  const count = (await favoriteNames(page)).length;
  // 让请求晚 1.5 秒才失败：先看到返回之前的乐观更新，再看到失败后的回滚，不留下写入。
  await failRequests(page, isServerAction, { delayMs: 1500 });

  await star(page, name).click();

  await expect(star(page, name)).toHaveAttribute("aria-pressed", "false", {
    timeout: 1000,
  });
  await expect(favorites(page)).toHaveCount(count - 1, { timeout: 1000 });
  await expect(page.getByText("更新收藏失败，请稍后重试")).toHaveCount(1);
  await expect(star(page, name)).toHaveAttribute("aria-pressed", "true");
  await expect(favorites(page)).toHaveCount(count);
});

test("在作品广场收藏后，列表页立即显示已收藏", async ({ page, tasks }) => {
  const name = await finishNewWork(page, tasks);
  // 先让“已完成”筛选的缓存里有这个未收藏的作品：之后列表要靠收藏的 Server Action 失效才显示已收藏。
  await filterByStatus(page, "已完成", "/tasks?status=done");
  const row = taskRow(page, name);
  await expect(row.getByRole("button", { name: "收藏" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await enterFeedWithNewWork(page, name);
  const saved = waitForServerAction(page);
  await star(page, name).click();
  await expect(favorites(page).first()).toContainText(name);
  await saved;

  await page.goto("/tasks?status=done");
  await expect(row.getByRole("button", { name: "收藏" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("在全部任务页收藏后回到作品广场，卡片和“我的收藏”都已更新", async ({
  page,
  tasks,
}) => {
  // 全程客户端导航：浏览器里的 React Query 缓存一直保留，这正是它可能显示旧收藏的情形。
  const name = await openFeedWithNewWork(page, tasks);
  const count = (await favoriteNames(page)).length;
  await navigateThroughHeader(page, "全部任务", "/tasks");
  const row = taskRow(page, name);
  const saved = waitForServerAction(page);
  await row.getByRole("button", { name: "收藏" }).click();
  await saved;

  await navigateThroughHeader(page, "作品广场", "/feed");
  await expect(star(page, name)).toHaveAttribute("aria-pressed", "true");
  await expect(favorites(page)).toHaveCount(count + 1);
  await expect(favorites(page).first()).toContainText(name);
});

test("加载到第二页后收藏第一页的作品，已加载的页不会被换掉", async ({
  page,
  tasks,
}) => {
  const name = await openFeedWithNewWork(page, tasks);
  await page.getByTestId("feed-end").scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(12);
  const saved = waitForServerAction(page);

  await star(page, name).click();
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
  tasks,
}) => {
  await openFeed(page);
  const before = await favoriteNames(page);
  const candidates = await unfavoritedCards(page);
  const createdAt = await tasks.createdAt([...before, ...candidates]);
  // 选一个比最新的收藏更早的作品：它在“我的收藏”里应当插到中间，而不是排在最前面。
  const newestFavorite = Math.max(
    ...before.map((name) => createdAt.get(name) ?? 0),
  );
  const name =
    candidates.find(
      (candidate) => (createdAt.get(candidate) ?? 0) < newestFavorite,
    ) ?? "";
  expect(name, "第一页里有比最新的收藏更早、还没收藏的作品").not.toBe("");
  const expected = [...before, name].sort(
    (a, b) => (createdAt.get(b) ?? 0) - (createdAt.get(a) ?? 0),
  );
  expect(expected.indexOf(name)).toBeGreaterThan(0);
  // 让收藏请求晚 3 秒才失败：断言的是返回之前乐观更新时的顺序，失败后收藏回滚，不留下数据。
  await failRequests(page, isServerAction, { delayMs: 3000 });

  await star(page, name).click();

  await expect(favorites(page)).toHaveText(expected, { timeout: 1000 });
});
