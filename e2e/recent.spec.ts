import type { Page } from "@playwright/test";

import { failRequests, hasPath } from "./browser";
import { expect, test } from "./tasks";

// 最近查看：任务 id 存在 localStorage 里，只有浏览器能读，请求要等 hydration 之后才发。

/** 打开详情并等到浏览记录写入：写入在 hydration 后的 effect 里，日志流结束说明页面已经 hydrate。 */
async function visitTask(page: Page, taskId: string) {
  await page.goto(`/tasks/${taskId}`);
  await expect(page.getByText("日志已结束")).toBeVisible();
}

const items = (page: Page) =>
  page.getByRole("list", { name: "最近查看" }).getByRole("listitem");

test("按查看顺序列出最近看过的任务，最新的在前", async ({ page }) => {
  await visitTask(page, "task-01");
  await visitTask(page, "task-07");

  await page.goto("/recent");

  await expect(items(page)).toHaveText([/雪地木屋/, /低多边形狐狸/]);
});

test("首次加载失败时显示加载失败，不弹全局提示", async ({ page }) => {
  await visitTask(page, "task-01");
  // 4xx 不重试，失败立即可见。
  await failRequests(page, hasPath("/api/tasks/task-01"), { status: 400 });

  await page.goto("/recent");

  await expect(items(page).first()).toContainText("加载失败（task-01）");
  await expect(page.getByText("请求失败，请稍后重试")).toHaveCount(0);
});

test("看过但已被删除的任务显示为已删除，不弹通用提示", async ({
  page,
  tasks,
}) => {
  // 已完成的任务打开后日志流立即结束，visitTask 才等得到。
  const task = await tasks.createTask({ status: "done" });
  await visitTask(page, task.id);
  await tasks.deleteTask(task.id);

  await page.goto("/recent");

  await expect(items(page).first()).toContainText("任务已被删除");
  await expect(page.getByText("请求失败，请稍后重试")).toHaveCount(0);
});

test("没有看过任务时显示空状态", async ({ page }) => {
  await page.goto("/recent");
  await expect(page.getByText("还没有查看过任务")).toBeVisible();
});
