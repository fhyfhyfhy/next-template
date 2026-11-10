import type { Page } from "@playwright/test";

import {
  clickForClientNavigation,
  holdRequests,
  isNavigation,
} from "./browser";
import { expect, test } from "./test";

test("UI catalog 不让搜索引擎收录，标题接上应用名", async ({ page }) => {
  await page.goto("/ui");

  await expect(page).toHaveTitle("组件 · Next Template");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
});

test("换组件后立即高亮新的一项，新示例到达前旧示例标记为更新中", async ({
  page,
}) => {
  await page.goto("/ui?component=field");
  // 示例表单的提交按钮在 hydration 之后才可用，和目录在同一个 Suspense 里。
  await expect(
    page.getByRole("button", { name: "提交", exact: true }),
  ).toBeEnabled();
  // 新组件的示例随导航请求从服务端返回，停住这个请求才看得到它到达之前的样子。
  const release = await holdRequests(page, isNavigation);
  const selectLink = page
    .getByRole("navigation", { name: "组件" })
    .getByRole("link", { name: "Select" });
  const busyHeading = page
    .locator('[aria-busy="true"]')
    .getByRole("heading", { level: 1, name: "Field" });

  await selectLink.click();

  await expect(selectLink).toHaveAttribute("aria-current", "page");
  await expect(busyHeading).toBeVisible();

  release();
  await expect(page).toHaveURL("/ui?component=select");
  await expect(
    page.getByRole("heading", { level: 1, name: "Select" }),
  ).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
});

// 先在 Field 页等到 hydration 完成，再经目录的链接做客户端导航：到达的页面全部由浏览器渲染，
// 之后的点击和输入不会落在还没接上事件的 HTML 上。
async function openComponent(page: Page, id: string, name: string) {
  await page.goto("/ui?component=field");
  await expect(
    page.getByRole("button", { name: "提交", exact: true }),
  ).toBeEnabled();
  await clickForClientNavigation(
    page,
    page.getByRole("navigation", { name: "组件" }).getByRole("link", { name }),
    `/ui?component=${id}`,
  );
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

function playground(page: Page) {
  return page.getByRole("region", { name: "交互实验室" });
}

function resetButton(page: Page) {
  return playground(page).getByRole("button", { name: "重置", exact: true });
}

test("改参数后画布和源码一起变，重置后一起恢复", async ({ page }) => {
  await openComponent(page, "switch", "Switch");
  await playground(page)
    .getByRole("button", { name: "查看代码", exact: true })
    .click();
  const source = playground(page).locator("pre");
  await expect(source).toContainText('"label": "自动保存"');

  await playground(page)
    .getByRole("textbox", { name: "label", exact: true })
    .fill("同步保存");

  await expect(
    playground(page).getByRole("switch", { name: "同步保存", exact: true }),
  ).toBeVisible();
  await expect(source).toContainText('"label": "同步保存"');

  await resetButton(page).click();

  await expect(
    playground(page).getByRole("switch", { name: "自动保存", exact: true }),
  ).toBeVisible();
  await expect(source).toContainText('"label": "自动保存"');
});

test("重置也让可调预览自己保存的状态回到初始值", async ({ page }) => {
  await openComponent(page, "button", "Button");
  await playground(page)
    .getByRole("button", { name: "开始创建", exact: true })
    .click();
  await expect(playground(page).getByText("已触发 1 次")).toBeVisible();

  await resetButton(page).click();

  await expect(playground(page).getByText("已触发 0 次")).toBeVisible();
});
