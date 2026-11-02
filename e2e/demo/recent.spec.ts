import type { Page } from "@playwright/test";

import { expect, test } from "./mock-api";

// Recently viewed: the task ids are in localStorage, which only the browser
// can read, so the requests go out only after hydration.

/**
 * Opens a task's detail and waits until the visit is recorded: the record is
 * written in an effect after hydration, and the end of the log stream means
 * the page has hydrated.
 */
async function visitTask(page: Page, taskId: string) {
  await page.goto(`/demos/tasks/${taskId}`);
  await expect(page.getByText("日志已结束")).toBeVisible();
}

const items = (page: Page) =>
  page.getByRole("list", { name: "最近查看" }).getByRole("listitem");

test("lists recently viewed tasks in viewing order, latest first", async ({
  page,
}) => {
  await visitTask(page, "task-01");
  await visitTask(page, "task-07");

  await page.goto("/demos/recent");

  await expect(items(page)).toHaveText([/雪地木屋/, /低多边形狐狸/]);
});

test("the server-rendered HTML holds no task data", async ({
  page,
  request,
}) => {
  await visitTask(page, "task-01");

  const html = await (await request.get("/demos/recent")).text();
  expect(html).not.toContain("低多边形狐狸");
});

test("a viewed task deleted since shows as deleted, with no generic toast", async ({
  page,
  mockApi,
}) => {
  await visitTask(page, "task-02");
  await mockApi.call("DELETE", "/demo/tasks/task-02");

  await page.goto("/demos/recent");

  await expect(items(page).first()).toContainText("任务已被删除");
  await expect(page.getByText("请求失败，请稍后重试")).toHaveCount(0);
});

test("with no task viewed, it shows the empty state", async ({ page }) => {
  await page.goto("/demos/recent");
  await expect(page.getByText("还没有查看过任务")).toBeVisible();
});
