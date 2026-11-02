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
  // eslint-disable-next-line e2e/act-after-ready -- “清除全部”只在浏览器读到故障配置后才渲染，找得到它时页面已经 hydrate。
  await section(page, "注入故障")
    .getByRole("button", { name: "清除全部" })
    .click();
  // 等清除生效再离开：离开页面会取消还在路上的请求，故障留着，列表页仍然失败。
  await expect(
    section(page, "注入故障").getByText("当前没有故障"),
  ).toBeVisible();
  await page.goto("/demos/tasks");
  await expect(page.getByRole("list", { name: "任务列表" })).toBeVisible();
});

test("故障面板修改默认延迟，重置 Mock 数据后恢复", async ({
  page,
  mockApi,
}) => {
  const latency = section(page, "注入故障").getByRole("combobox", {
    name: "默认延迟",
  });
  await expect(latency).toHaveText("500ms");

  await choose(page, latency, "2000ms");
  await expect.poll(() => mockApi.latency()).toBe(2000);
  await expect(latency).toHaveText("2000ms");

  await page.getByRole("button", { name: "重置 Mock 数据" }).click();
  await expect(latency).toHaveText("500ms");
  expect(await mockApi.latency()).toBe(500);
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

test("5xx 会重试，4xx、2xx 上的 error 和 schema 不匹配不重试", async ({
  page,
}) => {
  const demo = section(page, "重试规则");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  // 重试按 React Query 默认的指数退避分别等 1、2、4 秒。
  test.setTimeout(30_000);
  await demo.getByRole("button", { name: "5xx 两次后恢复" }).click();
  await expect(
    demo.getByText("5xx 两次后恢复：成功，失败 2 次后重试成功"),
  ).toBeVisible({ timeout: 10_000 });

  await demo.getByRole("button", { name: "5xx 一直失败" }).click();
  await expect(demo.getByText("5xx 一直失败：失败，重试了 3 次")).toBeVisible({
    timeout: 15_000,
  });

  await demo.getByRole("button", { name: "4xx" }).click();
  await expect(demo.getByText("4xx：失败，没有重试")).toBeVisible();

  await demo.getByRole("button", { name: "2xx 返回 error" }).click();
  await expect(demo.getByText("2xx 返回 error：失败，没有重试")).toBeVisible();

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
  // eslint-disable-next-line playwright/no-wait-for-timeout -- 断言一段时间内没有冒出第二个提示，等待是断言的一部分。
  await page.waitForTimeout(500);
  await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(1);
});

/** 打开故障实验室并等它 hydrate：故障列表只在浏览器里请求，和 Draft Mode 开关在同一个 Suspense 边界里。 */
async function openLab(page: Page) {
  await page.goto("/demos/lab");
  await expect(
    section(page, "注入故障").getByText("当前没有故障"),
  ).toBeVisible();
}

/** 点开关并等 Server Action 返回：开关先乐观显示新状态，cookie 随 action 的响应才写入。 */
async function toggleDraftMode(page: Page, checked: boolean) {
  const draft = section(page, "跳过服务端缓存").getByRole("switch", {
    name: "Draft Mode",
  });
  const saved = page.waitForResponse(
    (response) => response.request().headers()["next-action"] !== undefined,
  );
  await draft.click();
  await saved;
  await expect(draft).toBeChecked({ checked });
}

test("开启 Draft Mode 后跳过服务端缓存，关闭后恢复缓存", async ({
  page,
  mockApi,
}) => {
  const rows = page
    .getByRole("list", { name: "任务列表" })
    .getByRole("listitem");
  await page.goto("/demos/tasks?status=failed");
  await expect(rows).toHaveCount(3);

  // 缓存里是改名前的快照；不开 Draft Mode 时重新加载仍显示它（tasks.spec.ts 的服务端缓存用例）。
  await mockApi.call("PATCH", "/demo/tasks/task-05", { name: "开启后改名" });
  await openLab(page);
  await toggleDraftMode(page, true);
  await page.goto("/demos/tasks?status=failed");
  await expect(rows.filter({ hasText: "开启后改名" })).toHaveCount(1);

  await openLab(page);
  await expect(
    section(page, "跳过服务端缓存").getByRole("switch", { name: "Draft Mode" }),
  ).toBeChecked();
  await toggleDraftMode(page, false);

  // Draft Mode 下的读取不写缓存，关闭后读到的还是开启前缓存的快照，之后的改动也要等缓存刷新。
  await mockApi.call("PATCH", "/demo/tasks/task-05", { name: "关闭后改名" });
  await page.goto("/demos/tasks?status=failed");
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: "关闭后改名" })).toHaveCount(0);
});

test("Suspense query 失败进入错误边界，重置后重试成功", async ({ page }) => {
  const demo = section(page, "错误边界和重置");

  await demo.getByRole("button", { name: "加载（第一次会失败）" }).click();
  await expect(demo.getByRole("alert")).toContainText("加载失败");

  await demo.getByRole("button", { name: "重试" }).click();
  await expect(demo.getByText("重装机甲")).toBeVisible();
});
