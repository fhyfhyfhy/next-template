import type { Locator, Page } from "@playwright/test";

import { expect, resetThroughLab, test } from "./mock-api";

// 故障实验室：注入故障，观察请求失败时的提示、重试和错误边界。

const GLOBAL_ERROR_TOAST = "请求失败，请稍后重试";

const section = (page: Page, name: string) =>
  page.getByRole("region", { name });

async function choose(page: Page, combobox: Locator, option: string) {
  await combobox.click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await resetThroughLab(page);
});

test("故障面板注入的故障对其他页面生效，服务端渲染失败时显示 error.tsx", async ({
  page,
}) => {
  const panel = section(page, "注入故障");
  await choose(
    page,
    panel.getByRole("combobox", { name: "接口" }),
    "GET /demo/tasks",
  );
  await choose(page, panel.getByRole("combobox", { name: "故障" }), "返回 5xx");
  await choose(page, panel.getByRole("combobox", { name: "次数" }), "一直生效");
  await panel.getByRole("button", { name: "添加故障" }).click();
  await expect(panel.getByRole("listitem")).toHaveCount(1);

  await page.goto("/demos/tasks");
  await expect(
    page.getByRole("heading", { name: "页面加载失败" }),
  ).toBeVisible();

  await page.goto("/demos/lab");
  await section(page, "注入故障")
    .getByRole("button", { name: "清除全部" })
    .click();
  await page.goto("/demos/tasks");
  await expect(page.getByRole("list", { name: "任务列表" })).toBeVisible();
});

test("首次加载失败渲染错误；已有数据时刷新失败保留数据并弹提示", async ({
  page,
}) => {
  const demo = section(page, "首次加载和刷新失败");

  await demo.getByRole("button", { name: "首次加载（会失败）" }).click();
  await expect(demo.getByText("加载失败")).toBeVisible();
  await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(0);

  await demo.getByRole("button", { name: "首次加载（会成功）" }).click();
  await expect(demo.getByText("低多边形狐狸")).toBeVisible();

  await demo.getByRole("button", { name: "刷新（会失败）" }).click();
  await expect(page.getByText(GLOBAL_ERROR_TOAST)).toBeVisible();
  await expect(demo.getByText("低多边形狐狸")).toBeVisible();
});

test("5xx 会重试，4xx、业务 code 和 schema 不匹配不重试", async ({ page }) => {
  const demo = section(page, "重试规则");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await demo.getByRole("button", { name: "5xx 两次后恢复" }).click();
  // 两次重试分别等 1 秒和 2 秒（React Query 默认的指数退避）。
  await expect(
    demo.getByText("5xx 两次后恢复：成功，失败 2 次后重试成功"),
  ).toBeVisible({ timeout: 10_000 });

  await demo.getByRole("button", { name: "业务 code" }).click();
  await expect(demo.getByText("业务 code：失败，没有重试")).toBeVisible();

  await demo.getByRole("button", { name: "schema 不匹配" }).click();
  await expect(demo.getByText("schema 不匹配：失败，没有重试")).toBeVisible();
  await expect
    .poll(() => consoleErrors.join("\n"))
    .toContain("SchemaValidationError");
});

test("几个请求同时失败只弹一个提示", async ({ page }) => {
  const demo = section(page, "同时失败");
  await expect(demo.getByRole("listitem")).toHaveCount(3);

  await demo.getByRole("button", { name: "同时刷新（都会失败）" }).click();

  await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(1);
  await page.waitForTimeout(500);
  await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(1);
});

test("Suspense query 失败进入错误边界，重置后重试成功", async ({ page }) => {
  const demo = section(page, "错误边界和重置");

  await demo.getByRole("button", { name: "加载（第一次会失败）" }).click();
  await expect(demo.getByRole("alert")).toContainText("加载失败");

  await demo.getByRole("button", { name: "重试" }).click();
  await expect(demo.getByText("重装机甲")).toBeVisible();
});
