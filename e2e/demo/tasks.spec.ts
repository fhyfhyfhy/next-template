import { instant } from "@next/playwright";
import type { Page } from "@playwright/test";

import { expect, resetThroughLab, test } from "./mock-api";

// 全部任务页：数据由 Server Component 负责，筛选、排序、分页都在 URL 里。

test.beforeEach(async ({ page }) => {
  await resetThroughLab(page);
});

const rows = (page: Page) =>
  page.getByRole("list", { name: "任务列表" }).getByRole("listitem");

/**
 * 从别的 Data demo 页面经导航栏进入全部任务页，等列表出现。整页加载时列表在自己的 Suspense 边界里，
 * 可能比页面其他部分晚 hydrate，那之前换筛选，React 会丢掉服务端渲染的列表、直接显示骨架屏；
 * 客户端导航在浏览器里渲染整页，没有要等 hydrate 的部分。起点页导航栏的进行中徽标只在浏览器里请求，
 * 它和导航链接在同一个 Suspense 边界里，徽标出现说明链接已经 hydrate，点击是客户端导航。
 */
async function openTasksPage(page: Page) {
  await page.goto("/demos/search");
  await expect(page.getByLabel(/^进行中的任务 \d+ 个$/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Data demo 导航" })
    .getByRole("link", { name: "全部任务" })
    .click();
  await expect(page).toHaveURL("/demos/tasks");
  await expect(rows(page).first()).toBeVisible();
}

/** 去作品广场再按 Back 回来：离开时 Next 用 <Activity> 隐藏这一页，返回时保留状态、重新创建 effect。 */
async function leaveAndReturn(page: Page) {
  await page
    .getByRole("navigation", { name: "Data demo 导航" })
    .getByRole("link", { name: "作品广场" })
    .click();
  await expect(page).toHaveURL("/demos/feed");
  await page.goBack();
  await expect(page).toHaveURL("/demos/tasks");
}

test("从 Demo 首页进入全部任务，默认按创建时间倒序显示第一页", async ({
  page,
}) => {
  await page.goto("/demos");
  await page.getByRole("link", { name: /全部任务/ }).click();

  await expect(page).toHaveURL("/demos/tasks");
  await expect(rows(page)).toHaveCount(8);
  await expect(rows(page).first()).toContainText("多肉高模");
});

test("按状态筛选写进 URL，Back 回到上一个筛选", async ({ page }) => {
  await page.goto("/demos/tasks");
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

test("换筛选后立即显示新的选择，新列表到达前旧列表标记为更新中", async ({
  page,
  mockApi,
}) => {
  await openTasksPage(page);
  // 列表在服务端读 Mock API，拖慢它才看得到新列表到达之前的样子。
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

test("排序和分页写进 URL，前进后退都显示对应的数据", async ({ page }) => {
  await page.goto("/demos/tasks");
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

test("列表的骨架屏在静态 shell 里，数据随后流式送达", async ({
  page,
  baseURL,
}) => {
  // instant() 的作用域里，请求时才能渲染的内容都被扣住，页面停在静态 shell。
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

test("列表读服务端缓存：后端数据变了，缓存期内仍显示快照", async ({
  page,
  mockApi,
}) => {
  await page.goto("/demos/tasks?status=failed");
  await expect(rows(page)).toHaveCount(3);

  await mockApi.call("PATCH", "/demo/tasks/task-05", { name: "后台改名" });
  await page.reload();

  await expect(rows(page).filter({ hasText: "后台改名" })).toHaveCount(0);
});

test("创建任务后列表立即出现新任务，表单清空", async ({ page }) => {
  await openTasksPage(page);
  await page.getByLabel("名称").fill("新建的跑车");
  await page.getByLabel("Prompt").fill("一辆红色跑车");
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(rows(page).first()).toContainText("新建的跑车");
  await expect(rows(page).first()).toContainText("排队中");
  await expect(page.getByLabel("名称")).toHaveValue("");
});

// 页面每 3 秒检查一次进行中的任务，发现变化后再重新读取列表，等列表跟上要比默认的 5 秒宽。
const untilPolled = { timeout: 10_000 };

test("停在列表上，新任务的状态一直推进到已完成，header 的进行中数同时更新", async ({
  page,
  mockApi,
}) => {
  await openTasksPage(page);
  await page.getByLabel("名称").fill("推进中的任务");
  await page.getByLabel("Prompt").fill("一只狐狸");
  await page.getByRole("button", { name: "创建任务" }).click();
  const row = rows(page).filter({ hasText: "推进中的任务" });
  await expect(row).toContainText("排队中");
  // 种子数据里另有 4 个进行中的任务，时钟暂停，它们一直不变。
  await expect(page.getByLabel("进行中的任务 5 个")).toBeVisible();

  const href = await row.getByRole("link").getAttribute("href");
  const taskId = href?.split("/").at(-1) ?? "";
  await mockApi.advance(taskId);
  await expect(row).toContainText("生成中", untilPolled);

  await mockApi.advance(taskId, 5);
  await expect(row).toContainText("已完成", untilPolled);
  await expect(page.getByLabel("进行中的任务 4 个")).toBeVisible();
});

test("停在「生成中」筛选上，任务结束后从列表里消失，总数随之减少", async ({
  page,
  mockApi,
}) => {
  await page.goto("/demos/tasks?status=running");
  const finishing = rows(page).filter({ hasText: "复古跑车 v3" });
  await expect(finishing).toContainText("生成中");
  await expect(page.getByText("共 2 个任务")).toBeVisible();

  // 种子里生成中的任务进度是 50%，再推进 3 步到终态。
  await mockApi.advance("task-16", 3);

  await expect(finishing).toHaveCount(0, untilPolled);
  await expect(page.getByText("共 1 个任务")).toBeVisible();
});

test("停在「已完成」筛选上，别处的任务结束后出现在列表里", async ({
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

test("hydration 之前创建表单不可用", async ({ page }) => {
  // 拦掉 JS bundle，页面停在 hydration 之前。
  await page.route(/\/_next\/static\/chunks\/.+\.js/, (route) => route.abort());
  await page.goto("/demos/tasks");

  await expect(page.getByLabel("名称")).toBeDisabled();
  await expect(page.getByLabel("Prompt")).toBeDisabled();
  await expect(page.getByRole("button", { name: "创建任务" })).toBeDisabled();
});

test("创建时名称被占用，错误显示在名称字段下，不弹全局提示", async ({
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

test("创建成功后再提交被占用的名称，错误照样显示在名称字段下", async ({
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

test("填到一半离开再返回，输入还在，照样能提交", async ({ page }) => {
  await openTasksPage(page);
  await page.getByLabel("名称").fill("离开再回来");

  await leaveAndReturn(page);

  await expect(page.getByLabel("名称")).toHaveValue("离开再回来");
  await page.getByLabel("Prompt").fill("一只狐狸");
  await page.getByRole("button", { name: "创建任务" }).click();
  await expect(rows(page).first()).toContainText("离开再回来");
});

test("名称被占用后改了名字，离开再返回，改过的名字不会被改回去", async ({
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

test("名称为空时在浏览器里就拦下，不发请求", async ({ page }) => {
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

test("创建出错时弹全局提示，填的内容还在，重试能成功", async ({
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

test("收藏立即生效，请求完成前就显示已收藏", async ({ page, mockApi }) => {
  await mockApi.setFaults([
    { method: "PUT", path: "/demo/tasks/:id/favorite", latency_ms: 1500 },
  ]);
  await page.goto("/demos/tasks?status=failed");
  const star = rows(page).first().getByRole("button", { name: "收藏" });
  // 收藏走 Server Action，它返回时后端已经写入。
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

test("收藏失败时星标恢复原状并提示", async ({ page, mockApi }) => {
  await mockApi.setFaults([
    { method: "PUT", path: "/demo/tasks/:id/favorite", status: 500 },
  ]);
  await page.goto("/demos/tasks?status=failed");
  const star = rows(page).first().getByRole("button", { name: "收藏" });

  await star.click();

  await expect(page.getByText("收藏失败，请稍后重试")).toBeVisible();
  await expect(star).toHaveAttribute("aria-pressed", "false");
});

test("详情链接进入视口后就被预取", async ({ page }) => {
  // 生产构建里 Link 进入视口时预取目标路由；开发服务器不预取。
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

test("点进详情立即显示预取的骨架屏，详情随后送达", async ({ page }) => {
  await page.goto("/demos/tasks");
  const link = rows(page).first().getByRole("link");
  const name = (await link.textContent()) ?? "";

  // 作用域里只有预取到的部分能渲染：没预取到时导航提交不了，等 URL 会超时。
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

test("点进详情后 Back 回到原来的筛选和页码", async ({ page }) => {
  await page.goto("/demos/tasks?status=done&page=2");
  const link = rows(page).first().getByRole("link");
  const name = await link.textContent();

  await link.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name ?? "");

  await page.goBack();
  await expect(page).toHaveURL("/demos/tasks?status=done&page=2");
  await expect(rows(page).first().getByRole("link")).toHaveText(name ?? "");
});
