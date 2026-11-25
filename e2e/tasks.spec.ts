import { instant } from "@next/playwright";
import type { Page } from "@playwright/test";

import { failServerRead, unique } from "./backend";
import {
  delayRequests,
  expectNativelyDisabled,
  expectTextContrast,
  failRequests,
  holdRequests,
  isNavigation,
  isServerAction,
  openWithoutScripts,
  recordRequests,
  requestBodyIncludes,
  returnToTab,
  waitForServerAction,
} from "./browser";
import {
  createTaskThroughForm as createTask,
  expect,
  favoriteToggle,
  filterByStatus,
  isActiveTasksRequest,
  navigateThroughHeader,
  openTasksPage,
  runningCount,
  taskRow,
  taskRows as rows,
  test,
  untilPolled,
  waitForTaskList,
} from "./tasks";

// 全部任务页：数据由 Server Component 负责，筛选、排序、分页都在 URL 里。列表是所有任务的服务端缓存快照，
// 别的用例建的任务也会出现在里面：要写数据的用例在页面上建自己的任务，只对自己的任务断言。

// 要在列表上操作的用例经导航栏客户端导航进入（`openTasksPage`）：整页加载时列表在自己的 Suspense 边界里，可能比
// 页面其他部分晚 hydrate，那之前的点击可能丢失，换筛选时 React 还会丢掉服务端渲染的列表、直接显示骨架屏。

/** 去作品广场再按 Back 回来：离开时 Next 用 <Activity> 隐藏这一页，返回时保留状态、重新创建 effect。 */
async function leaveAndReturn(page: Page) {
  await navigateThroughHeader(page, "作品广场", "/feed");
  await page.goBack();
  await expect(page).toHaveURL("/tasks");
}

test("整页打开时 header 标出当前页，详情页上“全部任务”标为它的上级", async ({
  page,
}) => {
  const link = (name: string) =>
    page.getByRole("navigation", { name: "主要" }).getByRole("link", { name });

  await page.goto("/tasks");
  await expect(link("全部任务")).toHaveAttribute("aria-current", "page");

  await page.goto("/tasks/task-01");
  await expect(link("全部任务")).toHaveAttribute("aria-current", "true");

  await page.goto("/feed");
  await expect(link("作品广场")).toHaveAttribute("aria-current", "page");
  await expect(link("全部任务")).not.toHaveAttribute("aria-current");
});

for (const { colorScheme, label } of [
  { colorScheme: "light", label: "浅色主题" },
  { colorScheme: "dark", label: "深色主题" },
] as const) {
  test.describe(label, () => {
    test.use({ colorScheme });

    test("header 当前页的文字和背景对比度不低于 4.5:1", async ({ page }) => {
      await page.goto("/tasks");
      const current = page
        .getByRole("navigation", { name: "主要" })
        .getByRole("link", { name: "全部任务" });
      await expect(current).toHaveAttribute("aria-current", "page");
      // next-themes 跟着系统（这里是 colorScheme）选主题，在 html 上加同名的 class。
      await expect(page.locator("html")).toContainClass(colorScheme);

      await expectTextContrast(current);
    });
  });
}

test("全部任务默认显示第一页", async ({ page }) => {
  await page.goto("/tasks");

  await expect(rows(page)).toHaveCount(8);
  await expect(page.getByRole("link", { name: "下一页" })).toBeVisible();
  await expect(page.getByRole("link", { name: "上一页" })).toHaveCount(0);
});

test("按状态筛选写进 URL，Back 回到上一个筛选", async ({ page }) => {
  await openTasksPage(page);
  await filterByStatus(page, "失败", "/tasks?status=failed");

  await expect(rows(page).first()).toBeVisible();
  for (const item of await rows(page).all()) {
    await expect(item).toContainText("失败");
  }

  await page.goBack();
  await expect(page).toHaveURL("/tasks");
  await expect(rows(page)).toHaveCount(8);
  await expect(rows(page).filter({ hasNotText: "失败" }).first()).toBeVisible();
});

test("换筛选后立即显示新的选择，新列表到达前旧列表标记为更新中", async ({
  page,
}) => {
  await openTasksPage(page);
  // 新列表随导航请求从服务端返回，拖慢这个请求才看得到它到达之前的样子。
  await delayRequests(page, isNavigation, 2000);
  const failedTab = page
    .getByRole("tablist", { name: "按状态筛选" })
    .getByRole("tab", { name: "失败" });
  const busyList = page
    .locator('[aria-busy="true"]')
    .getByRole("list", { name: "任务列表" });

  await failedTab.click();

  await expect(failedTab).toHaveAttribute("aria-selected", "true");
  await expect(busyList).toBeVisible();

  await expect(page).toHaveURL("/tasks?status=failed");
  await expect(busyList).toHaveCount(0);
  await expect(rows(page).first()).toBeVisible();
  for (const item of await rows(page).all()) {
    await expect(item).toContainText("失败");
  }
});

test("排序和分页写进 URL，前进后退都显示对应的数据", async ({ page }) => {
  await openTasksPage(page);
  await page.getByRole("combobox", { name: "排序" }).click();
  await page.getByRole("option", { name: "名称" }).click();
  await expect(page).toHaveURL("/tasks?sort=name_asc");
  await waitForTaskList(page);
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
  tasks,
}) => {
  await openTasksPage(page);
  // 先让任务结束：之后它不在进行中，页面的变化检查不会因为它重新读取列表。
  const task = await createTask(page, unique("别处改名的任务"));
  await tasks.reportProgress(task.id, {
    status: "failed",
    progress: 100,
    log: "生成失败：材质计算出错",
  });
  await expect(taskRow(page, task.name)).toContainText("失败", untilPolled);

  const renamed = unique("别处改的名字");
  await tasks.renameTask(task.id, renamed);
  await page.reload();

  await expect(taskRow(page, task.name)).toBeVisible();
  await expect(taskRow(page, renamed)).toHaveCount(0);
});

test("创建任务后列表立即出现新任务，表单清空", async ({ page }) => {
  await openTasksPage(page);
  // 让进行中任务的轮询失败：列表的变化信号发现不了新任务，列表只能靠创建的 Server Action 让缓存失效来更新。
  await failRequests(page, isActiveTasksRequest, { status: 400 });
  const { name } = await createTask(page, unique("新建的跑车"));

  await expect(taskRow(page, name)).toContainText("排队中");
  await expect(page.getByLabel("名称")).toHaveValue("");
});

test("header 徽标首次加载失败后，重新请求期间仍显示加载失败", async ({
  page,
}) => {
  // 徽标的数据由服务端预取。让服务端读任务表失败，预取跟着失败，浏览器没有数据就自己请求，这里也让它失败（4xx
  // 不重试）。最近查看页的服务端渲染只有徽标读任务表，锁表和读取失败不影响页面的其他部分。
  await failRequests(page, isActiveTasksRequest, { status: 400 });
  await failServerRead("tasks", () =>
    page.goto("/recent", { waitUntil: "commit" }),
  );
  const failed = page
    .getByRole("banner")
    .getByText("加载失败", { exact: true });
  await expect(failed).toBeVisible();
  const releasePoll = await holdRequests(page, isActiveTasksRequest);

  // 回到标签页时徽标立即重新请求，请求停在浏览器里。
  const polled = page.waitForRequest(isActiveTasksRequest);
  await returnToTab(page);
  await polled;

  // 重新请求一开始 React Query 就清空了 error，只看 error 的话徽标随即换成骨架屏。请求停着，放行之前徽标不会再变，
  // 所以最后看一次就够。
  // eslint-disable-next-line playwright/no-wait-for-timeout -- 等过这段时间仍显示加载失败，等待是断言的一部分。
  await page.waitForTimeout(500);
  await expect(failed).toBeVisible();
  releasePoll();
});

test("停在列表上，新任务的状态一直推进到已完成，header 的进行中数同时更新", async ({
  page,
  tasks,
}) => {
  await openTasksPage(page);
  const before = await runningCount(page);
  const task = await createTask(page);
  await expect(taskRow(page, task.name)).toContainText("排队中");
  await expect(
    page.getByText(`进行中的任务 ${before + 1} 个`, { exact: true }),
  ).toBeAttached();

  await tasks.reportProgress(task.id, {
    status: "running",
    progress: 0,
    log: "开始生成",
  });
  await expect(taskRow(page, task.name)).toContainText("生成中", untilPolled);

  await tasks.reportProgress(task.id, {
    status: "done",
    progress: 100,
    log: "生成完成",
  });
  await expect(taskRow(page, task.name)).toContainText("已完成", untilPolled);
  await expect(
    page.getByText(`进行中的任务 ${before} 个`, { exact: true }),
  ).toBeAttached();
});

test("停在「生成中」筛选上，任务结束后从列表里消失，总数随之减少", async ({
  page,
  tasks,
}) => {
  await openTasksPage(page);
  const task = await createTask(page);
  await tasks.reportProgress(task.id, {
    status: "running",
    progress: 50,
    log: "生成网格",
  });
  await filterByStatus(page, "生成中", "/tasks?status=running");
  await expect(taskRow(page, task.name)).toContainText("生成中", untilPolled);
  const total = page.getByText(/^共 \d+ 个任务$/);
  const before = Number(/\d+/.exec((await total.textContent()) ?? "")?.[0]);

  await tasks.reportProgress(task.id, {
    status: "done",
    progress: 100,
    log: "生成完成",
  });

  await expect(taskRow(page, task.name)).toHaveCount(0, untilPolled);
  await expect(page.getByText(`共 ${before - 1} 个任务`)).toBeVisible();
});

test("停在「已完成」筛选上，别处的任务结束后出现在列表里", async ({
  page,
  tasks,
}) => {
  await openTasksPage(page);
  const task = await createTask(page);
  await filterByStatus(page, "已完成", "/tasks?status=done");
  await expect(taskRow(page, task.name)).toHaveCount(0);

  await tasks.reportProgress(task.id, {
    status: "done",
    progress: 100,
    log: "生成完成",
  });

  await expect(taskRow(page, task.name)).toContainText("已完成", untilPolled);
});

test("hydration 之前创建表单不可用", async ({ page }) => {
  const htmlPage = await openWithoutScripts(page, "/tasks");

  await expect(htmlPage.getByLabel("名称")).toBeDisabled();
  await expect(htmlPage.getByLabel("Prompt")).toBeDisabled();
  await expectNativelyDisabled(
    htmlPage.getByRole("button", { name: "创建任务" }),
  );
  await htmlPage.close();
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
  await expect(taskRow(page, name)).toBeVisible();
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
  const prompt = unique("e2e prompt");
  // 列表的变化信号也会调 Server Action：只记带这次 prompt 的。
  const actions = recordRequests(
    page,
    (request) =>
      isServerAction(request) && requestBodyIncludes(prompt)(request),
  );
  await page.getByLabel("Prompt").fill(prompt);
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(page.getByText("请输入名称")).toBeVisible();
  expect(actions).toStrictEqual([]);
});

test("名称为空时提交，焦点移到名称字段", async ({ page }) => {
  await openTasksPage(page);
  await page.getByLabel("Prompt").fill(unique("e2e prompt"));
  await page.getByRole("button", { name: "创建任务" }).click();
  await expect(page.getByText("请输入名称")).toBeVisible();

  // 点「创建任务」时焦点在按钮上，校验失败后移到第一个无效的字段。
  await expect(page.getByLabel("名称")).toBeFocused();
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
  await expect(taskRow(page, name)).toBeVisible();
});

test("收藏立即生效，请求完成前就显示已收藏", async ({ page }) => {
  await openTasksPage(page);
  const { id, name } = await createTask(page);
  // 收藏的 Server Action 放行之前，星标只能来自乐观更新。
  const release = await holdRequests(page, isServerAction);
  const star = favoriteToggle(rows(page), name);

  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");

  // 等这次收藏的响应：返回时写入和缓存失效都已完成；列表的变化信号也会调 Server Action，按任务 id 认出它。
  const saved = waitForServerAction(page, requestBodyIncludes(id));
  release();
  await saved;
  await page.reload();
  await expect(favoriteToggle(rows(page), name)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("收藏失败时星标恢复原状，只弹一个全局提示", async ({ page }) => {
  await openTasksPage(page);
  const { name } = await createTask(page);
  await failRequests(page, isServerAction);
  const star = favoriteToggle(rows(page), name);

  await star.click();

  await expect(page.getByText("更新收藏失败，请稍后重试")).toHaveCount(1);
  await expect(star).toHaveAttribute("aria-pressed", "false");
});

test("详情链接进入视口后就被预取", async ({ page }) => {
  // 生产构建里 Link 进入视口时预取目标路由；开发服务器不预取。
  const prefetches = recordRequests(
    page,
    (request) => request.headers()["next-router-prefetch"] === "1",
  );
  await page.goto("/tasks");

  await expect
    .poll(() =>
      prefetches.some((request) =>
        new URL(request.url()).pathname.startsWith("/tasks/"),
      ),
    )
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
  await waitForTaskList(page);
  const link = rows(page).first().getByRole("link");
  const name = await link.textContent();

  await link.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name ?? "");

  await page.goBack();
  await expect(page).toHaveURL("/tasks?status=done&page=2");
  await expect(rows(page).first().getByRole("link")).toHaveText(name ?? "");
});
