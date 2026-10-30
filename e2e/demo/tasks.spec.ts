import { instant } from "@next/playwright";

import { expect, resetThroughLab, test } from "./mock-api";

// 全部任务页：数据由 Server Component 负责，筛选、排序、分页都在 URL 里。

test.beforeEach(async ({ page }) => {
  await resetThroughLab(page);
});

const rows = (page: import("@playwright/test").Page) =>
  page.getByRole("list", { name: "任务列表" }).getByRole("listitem");

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
  await page.goto("/demos/tasks");
  await page.getByLabel("名称").fill("新建的跑车");
  await page.getByLabel("Prompt").fill("一辆红色跑车");
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(rows(page).first()).toContainText("新建的跑车");
  await expect(rows(page).first()).toContainText("排队中");
  await expect(page.getByLabel("名称")).toHaveValue("");
});

test("创建时名称被占用，错误显示在名称字段下，不弹全局提示", async ({
  page,
}) => {
  await page.goto("/demos/tasks");
  await page.getByLabel("名称").fill("低多边形狐狸");
  await page.getByLabel("Prompt").fill("一只狐狸");
  await page.getByRole("button", { name: "创建任务" }).click();

  await expect(page.getByText("名称已被其他任务占用")).toBeVisible();
  await expect(page.getByText("请求失败，请稍后重试")).toHaveCount(0);

  await page.getByLabel("名称").fill("低多边形狐狸 2");
  await expect(page.getByText("名称已被其他任务占用")).toHaveCount(0);
});

test("名称为空时在浏览器里就拦下，不发请求", async ({ page }) => {
  await page.goto("/demos/tasks");
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
