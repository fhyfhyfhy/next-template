import { instant } from "@next/playwright";
import type { Page } from "@playwright/test";

import {
  expect,
  navigateThroughHeader,
  runningCount,
  test,
  unique,
} from "./backend";
import {
  delayRequests,
  failRequests,
  isNavigation,
  isServerAction,
} from "./browser";

// 全部任务页：数据由 Server Component 负责，筛选、排序、分页都在 URL 里。列表是所有任务的服务端缓存快照，
// 别的用例建的任务也会出现在里面：要写数据的用例在页面上建自己的任务，只对自己的任务断言。

const rows = (page: Page) =>
  page.getByRole("list", { name: "任务列表" }).getByRole("listitem");

const row = (page: Page, name: string) => rows(page).filter({ hasText: name });

/**
 * 从别的任务页面经导航栏进入全部任务页，等列表出现。整页加载时列表在自己的 Suspense 边界里，
 * 可能比页面其他部分晚 hydrate：那之前的点击可能丢失，换筛选时 React 还会丢掉服务端渲染的列表、直接显示骨架屏。
 * 客户端导航（`navigateThroughHeader`）在浏览器里渲染整页，没有要等 hydrate 的部分。
 */
async function openTasksPage(page: Page) {
  await page.goto("/search");
  await navigateThroughHeader(page, "全部任务", "/tasks");
  await expect(rows(page).first()).toBeVisible();
}

/** 在已经打开的全部任务页上用表单建一个任务，等它出现在列表里。 */
async function createTask(page: Page, name = unique("新任务")) {
  await page.getByLabel("名称").fill(name);
  await page.getByLabel("Prompt").fill(unique("e2e prompt"));
  await page.getByRole("button", { name: "创建任务" }).click();
  await expect(row(page, name)).toBeVisible();
  const href = await row(page, name).getByRole("link").getAttribute("href");
  return { name, id: href?.split("/").at(-1) ?? "" };
}

/** 在已经打开的全部任务页上点一个状态筛选，等新列表到达。 */
async function filterByStatus(page: Page, label: string, url: string) {
  await page
    .getByRole("navigation", { name: "按状态筛选" })
    .getByRole("link", { name: label })
    .click();
  await expect(page).toHaveURL(url);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** 去作品广场再按 Back 回来：离开时 Next 用 <Activity> 隐藏这一页，返回时保留状态、重新创建 effect。 */
async function leaveAndReturn(page: Page) {
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name: "作品广场" })
    .click();
  await expect(page).toHaveURL("/feed");
  await page.goBack();
  await expect(page).toHaveURL("/tasks");
}

// 页面每 3 秒检查一次进行中的任务，发现变化后再重新读取列表，等列表跟上要比默认的 5 秒宽。
const untilPolled = { timeout: 10_000 };

test("首页就是全部任务，默认显示第一页", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/tasks");
  await expect(rows(page)).toHaveCount(8);
  await expect(page.getByRole("link", { name: "下一页" })).toBeVisible();
});

test("按状态筛选写进 URL，Back 回到上一个筛选", async ({ page }) => {
  await openTasksPage(page);
  await page.getByRole("link", { name: "失败" }).click();

  await expect(page).toHaveURL("/tasks?status=failed");
  await expect(rows(page).first()).toBeVisible();
  for (const item of await rows(page).all()) {
    await expect(item).toContainText("失败");
  }

  await page.goBack();
  await expect(page).toHaveURL("/tasks");
  await expect(rows(page)).toHaveCount(8);
});

test("换筛选后立即显示新的选择，新列表到达前旧列表标记为更新中", async ({
  page,
}) => {
  await openTasksPage(page);
  // 新列表随导航请求从服务端返回，拖慢这个请求才看得到它到达之前的样子。
  await delayRequests(page, isNavigation, 2000);
  const failedTab = page
    .getByRole("navigation", { name: "按状态筛选" })
    .getByRole("link", { name: "失败" });
  const busyList = page
    .locator('[aria-busy="true"]')
    .getByRole("list", { name: "任务列表" });

  await failedTab.click();

  await expect(failedTab).toHaveAttribute("aria-current", "page");
  await expect(busyList).toBeVisible();

  await expect(page).toHaveURL("/tasks?status=failed");
  await expect(busyList).toHaveCount(0);
  for (const item of await rows(page).all()) {
    await expect(item).toContainText("失败");
  }
});

test("排序和分页写进 URL，前进后退都显示对应的数据", async ({ page }) => {
  await openTasksPage(page);
  await page.getByRole("combobox", { name: "排序" }).click();
  await page.getByRole("option", { name: "名称" }).click();
  await expect(page).toHaveURL("/tasks?sort=name_asc");
  const firstByName = await rows(page).first().textContent();

  await page.getByRole("link", { name: "下一页" }).click();
  await expect(page).toHaveURL("/tasks?sort=name_asc&page=2");
  await expect(rows(page).first()).not.toHaveText(firstByName ?? "");

  await page.goBack();
  await expect(rows(page).first()).toHaveText(firstByName ?? "");
  await page.goForward();
  await expect(page).toHaveURL("/tasks?sort=name_asc&page=2");
});

test("列表的骨架屏在静态 shell 里，数据随后流式送达", async ({
  page,
  baseURL,
}) => {
  // instant() 的作用域里，请求时才能渲染的内容都被扣住，页面停在静态 shell。
  await instant(
    page,
    async () => {
      await page.goto("/tasks?status=done");
      await expect(page.getByTestId("task-list-skeleton")).toBeVisible();
      await expect(rows(page)).toHaveCount(0);
    },
    { baseURL },
  );

  await expect(rows(page).first()).toBeVisible();
});

test("列表读服务端缓存：别处改了数据，缓存期内仍显示快照", async ({
  page,
  backend,
}) => {
  await openTasksPage(page);
  // 名称带 fail 的任务生成失败。先让它结束：之后它不在进行中，页面的变化检查不会因为它重新读取列表。
  const task = await createTask(page, unique("改名 fail"));
  await backend.reportProgress(task.id, {
    status: "failed",
    progress: 100,
    log: "生成失败：材质计算出错",
  });
  await expect(row(page, task.name)).toContainText("失败", untilPolled);

  await backend.renameTask(task.id, unique("别处改的名字"));
  await page.reload();

  await expect(row(page, task.name)).toBeVisible();
  await expect(rows(page).filter({ hasText: "别处改的名字" })).toHaveCount(0);
});

test("创建任务后列表立即出现新任务，表单清空", async ({ page }) => {
  await openTasksPage(page);
  const name = unique("新建的跑车");
  await page.getByLabel("名称").fill(name);
  await page.getByLabel("Prompt").fill(unique("e2e prompt"));
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(row(page, name)).toContainText("排队中");
  await expect(page.getByLabel("名称")).toHaveValue("");
});

test("停在列表上，新任务的状态一直推进到已完成，header 的进行中数同时更新", async ({
  page,
  backend,
}) => {
  await openTasksPage(page);
  const before = await runningCount(page);
  const task = await createTask(page);
  await expect(row(page, task.name)).toContainText("排队中");
  await expect(page.getByLabel(`进行中的任务 ${before + 1} 个`)).toBeVisible();

  await backend.reportProgress(task.id, {
    status: "running",
    progress: 0,
    log: "开始生成",
  });
  await expect(row(page, task.name)).toContainText("生成中", untilPolled);

  await backend.reportProgress(task.id, {
    status: "done",
    progress: 100,
    log: "生成完成",
  });
  await expect(row(page, task.name)).toContainText("已完成", untilPolled);
  await expect(page.getByLabel(`进行中的任务 ${before} 个`)).toBeVisible();
});

test("停在「生成中」筛选上，任务结束后从列表里消失，总数随之减少", async ({
  page,
  backend,
}) => {
  await openTasksPage(page);
  const task = await createTask(page);
  await backend.reportProgress(task.id, {
    status: "running",
    progress: 50,
    log: "生成网格",
  });
  await filterByStatus(page, "生成中", "/tasks?status=running");
  await expect(row(page, task.name)).toContainText("生成中", untilPolled);
  const total = page.getByText(/^共 \d+ 个任务$/);
  const before = Number(/\d+/.exec((await total.textContent()) ?? "")?.[0]);

  await backend.reportProgress(task.id, {
    status: "done",
    progress: 100,
    log: "生成完成",
  });

  await expect(row(page, task.name)).toHaveCount(0, untilPolled);
  await expect(page.getByText(`共 ${before - 1} 个任务`)).toBeVisible();
});

test("停在「已完成」筛选上，别处的任务结束后出现在列表里", async ({
  page,
  backend,
}) => {
  await openTasksPage(page);
  const task = await createTask(page);
  await filterByStatus(page, "已完成", "/tasks?status=done");
  await expect(row(page, task.name)).toHaveCount(0);

  await backend.reportProgress(task.id, {
    status: "done",
    progress: 100,
    log: "生成完成",
  });

  await expect(row(page, task.name)).toContainText("已完成", untilPolled);
});

test("hydration 之前创建表单不可用", async ({ page }) => {
  // 拦掉 JS bundle，页面停在 hydration 之前。
  await page.route(/\/_next\/static\/chunks\/.+\.js/, (route) => route.abort());
  await page.goto("/tasks");

  await expect(page.getByLabel("名称")).toBeDisabled();
  await expect(page.getByLabel("Prompt")).toBeDisabled();
  await expect(page.getByRole("button", { name: "创建任务" })).toBeDisabled();
});

test("创建时名称被占用，错误显示在名称字段下，不弹全局提示", async ({
  page,
}) => {
  await openTasksPage(page);
  // 种子数据里的任务名。
  await page.getByLabel("名称").fill("低多边形狐狸");
  await page.getByLabel("Prompt").fill(unique("e2e prompt"));
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(page.getByText("名称已被其他任务占用")).toBeVisible();
  await expect(page.getByText("创建任务失败，请稍后重试")).toHaveCount(0);

  await page.getByLabel("名称").fill("低多边形狐狸 2");
  await expect(page.getByText("名称已被其他任务占用")).toHaveCount(0);
});

test("创建成功后再提交被占用的名称，错误照样显示在名称字段下", async ({
  page,
}) => {
  await openTasksPage(page);
  const { name } = await createTask(page);
  await expect(page.getByLabel("名称")).toHaveValue("");

  await page.getByLabel("名称").fill(name);
  await page.getByLabel("Prompt").fill(unique("另一个 prompt"));
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(page.getByText("名称已被其他任务占用")).toBeVisible();
});

test("填到一半离开再返回，输入还在，照样能提交", async ({ page }) => {
  await openTasksPage(page);
  const name = unique("离开再回来");
  await page.getByLabel("名称").fill(name);

  await leaveAndReturn(page);

  await expect(page.getByLabel("名称")).toHaveValue(name);
  await page.getByLabel("Prompt").fill(unique("e2e prompt"));
  await page.getByRole("button", { name: "创建任务" }).click();
  await expect(row(page, name)).toBeVisible();
});

test("名称被占用后改了名字，离开再返回，改过的名字不会被改回去", async ({
  page,
}) => {
  await openTasksPage(page);
  await page.getByLabel("名称").fill("低多边形狐狸");
  await page.getByLabel("Prompt").fill(unique("e2e prompt"));
  await page.getByRole("button", { name: "创建任务" }).click();
  await expect(page.getByText("名称已被其他任务占用")).toBeVisible();
  await page.getByLabel("名称").fill("改过的名字");

  await leaveAndReturn(page);

  await expect(page.getByLabel("名称")).toHaveValue("改过的名字");
  await expect(page.getByText("名称已被其他任务占用")).toHaveCount(0);
});

test("名称为空时在浏览器里就拦下，不发请求", async ({ page }) => {
  await openTasksPage(page);
  let created = false;
  page.on("request", (request) => {
    if (isServerAction(request)) created = true;
  });
  await page.getByLabel("Prompt").fill(unique("e2e prompt"));
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(page.getByText("请输入名称")).toBeVisible();
  expect(created).toBe(false);
});

test("创建出错时弹全局提示，填的内容还在，重试能成功", async ({ page }) => {
  await openTasksPage(page);
  const restore = await failRequests(page, isServerAction);
  const name = unique("出错的任务");
  const prompt = unique("e2e prompt");
  await page.getByLabel("名称").fill(name);
  await page.getByLabel("Prompt").fill(prompt);
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(page.getByText("创建任务失败，请稍后重试")).toHaveCount(1);
  await expect(page.getByLabel("名称")).toHaveValue(name);
  await expect(page.getByLabel("Prompt")).toHaveValue(prompt);

  await restore();
  await page.getByRole("button", { name: "创建任务" }).click();
  await expect(row(page, name)).toBeVisible();
});

test("收藏立即生效，请求完成前就显示已收藏", async ({ page }) => {
  await openTasksPage(page);
  const { name } = await createTask(page);
  await delayRequests(page, isServerAction, 1500);
  const star = row(page, name).getByRole("button", { name: "收藏" });
  // 收藏走 Server Action，它返回时后端已经写入。
  const saved = page.waitForResponse((response) =>
    isServerAction(response.request()),
  );

  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");

  await saved;
  await page.reload();
  await expect(
    row(page, name).getByRole("button", { name: "收藏" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("收藏失败时星标恢复原状，只弹一个全局提示", async ({ page }) => {
  await openTasksPage(page);
  const { name } = await createTask(page);
  await failRequests(page, isServerAction);
  const star = row(page, name).getByRole("button", { name: "收藏" });

  await star.click();

  await expect(page.getByText("更新收藏失败，请稍后重试")).toHaveCount(1);
  await expect(star).toHaveAttribute("aria-pressed", "false");
});

test("详情链接进入视口后就被预取", async ({ page }) => {
  // 生产构建里 Link 进入视口时预取目标路由；开发服务器不预取。
  const prefetchedPaths: string[] = [];
  page.on("request", (request) => {
    if (request.headers()["next-router-prefetch"] === "1")
      prefetchedPaths.push(new URL(request.url()).pathname);
  });
  await page.goto("/tasks");

  await expect
    .poll(() => prefetchedPaths.some((path) => path.startsWith("/tasks/")))
    .toBe(true);
});

test("点进详情立即显示预取的骨架屏，详情随后送达", async ({ page }) => {
  await openTasksPage(page);
  const link = rows(page).first().getByRole("link");
  const name = (await link.textContent()) ?? "";

  // 作用域里只有预取到的部分能渲染：没预取到时导航提交不了，等 URL 会超时。
  await instant(page, async () => {
    await link.click();
    await page.waitForURL(/\/tasks\/[^/]+$/);
    await expect(page.getByTestId("task-detail-skeleton")).toBeVisible();
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(
      0,
    );
  });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
});

test("点进详情后 Back 回到原来的筛选和页码", async ({ page }) => {
  await openTasksPage(page);
  await filterByStatus(page, "已完成", "/tasks?status=done");
  await page.getByRole("link", { name: "下一页" }).click();
  await expect(page).toHaveURL("/tasks?status=done&page=2");
  const link = rows(page).first().getByRole("link");
  const name = await link.textContent();

  await link.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name ?? "");

  await page.goBack();
  await expect(page).toHaveURL("/tasks?status=done&page=2");
  await expect(rows(page).first().getByRole("link")).toHaveText(name ?? "");
});
