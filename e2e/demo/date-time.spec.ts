import type { Page } from "@playwright/test";

import { expect, test } from "./mock-api";

// 日期和时间按电脑所在时区显示，页面 hydrate 之后由浏览器填上（components/date-time.tsx）。
// 第一个种子任务创建于 2026-10-01T00:00Z。
async function expectCreatedAt(page: Page, text: RegExp) {
  await page.goto("/en/demos/tasks/task-01");
  const createdAt = page
    .locator("dt", { hasText: "Created" })
    .locator("xpath=following-sibling::dd[1]");
  await expect(createdAt).toHaveText(text);
}

test.describe("在纽约", () => {
  test.use({ timezoneId: "America/New_York" });

  test("任务的创建时间按纽约时间显示", async ({ page }) => {
    await expectCreatedAt(page, /^Sep 30, 2026, 8:00\sPM$/);
  });
});

test.describe("在上海", () => {
  test.use({ timezoneId: "Asia/Shanghai" });

  test("同一个时间按上海时间显示", async ({ page }) => {
    await expectCreatedAt(page, /^Oct 1, 2026, 8:00\sAM$/);
  });
});
