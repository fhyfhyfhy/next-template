import type { Page } from "@playwright/test";

import { expect, test } from "./mock-api";

// 最近查看：任务 id 存在 localStorage 里，只有浏览器能读，请求要等 hydration 之后才发。

/** 打开详情并等到浏览记录写入：写入在 hydration 后的 effect 里，日志流结束说明客户端已经接管。 */
async function visitTask(page: Page, taskId: string) {
  await page.goto(`/demos/tasks/${taskId}`);
  await expect(page.getByText("日志已结束")).toBeVisible();
}

const items = (page: Page) =>
  page.getByRole("list", { name: "最近查看" }).getByRole("listitem");

test("按查看顺序列出最近看过的任务，最新的在前", async ({ page }) => {
  await visitTask(page, "task-01");
  await visitTask(page, "task-07");

  await page.goto("/demos/recent");

  await expect(items(page)).toHaveText([/雪地木屋/, /低多边形狐狸/]);
});

test("服务端渲染的 HTML 里没有任务数据", async ({ page, request }) => {
  await visitTask(page, "task-01");

  const html = await (await request.get("/demos/recent")).text();
  expect(html).not.toContain("低多边形狐狸");
});

test("看过但已被删除的任务显示为已删除，不弹通用提示", async ({
  page,
  mockApi,
}) => {
  await visitTask(page, "task-02");
  await mockApi.call("DELETE", "/demo/tasks/task-02");

  await page.goto("/demos/recent");

  await expect(items(page).first()).toContainText("任务已被删除");
  await expect(page.getByText("请求失败，请稍后重试")).toHaveCount(0);
});

test("没有看过任务时显示空状态", async ({ page }) => {
  await page.goto("/demos/recent");
  await expect(page.getByText("还没有查看过任务")).toBeVisible();
});
