import type { Page } from "@playwright/test";

import { expect, test } from "./test";

// 日期和时间按电脑所在时区显示，页面 hydrate 之后由浏览器填上（components/date-time.tsx）。
// 第一个种子任务创建于 2026-10-01T00:00Z。用例看英文页面：浏览器语言是英文时，页面就按英文显示。
test.use({ locale: "en-US" });

async function expectCreatedAt(page: Page, text: RegExp) {
  await page.goto("/tasks/task-01");
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
