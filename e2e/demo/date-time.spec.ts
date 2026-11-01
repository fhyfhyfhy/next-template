import type { Page } from "@playwright/test";

import { expect, test } from "./mock-api";

// Dates and times show in the computer's time zone, which the browser fills
// in once the page has hydrated (components/date-time.tsx). The Mock API's
// first task was created at 2026-10-01T00:00Z (scripts/mock-api/seed.mjs).
async function expectCreatedAt(page: Page, text: RegExp) {
  await page.goto("/en/demos/tasks/task-01");
  const createdAt = page
    .locator("dt", { hasText: "Created" })
    .locator("xpath=following-sibling::dd[1]");
  await expect(createdAt).toHaveText(text);
}

test.describe("in New York", () => {
  test.use({ timezoneId: "America/New_York" });

  test("a task's creation time shows in New York time", async ({ page }) => {
    await expectCreatedAt(page, /^Sep 30, 2026, 8:00\sPM$/);
  });
});

test.describe("in Shanghai", () => {
  test.use({ timezoneId: "Asia/Shanghai" });

  test("the same time shows in Shanghai time", async ({ page }) => {
    await expectCreatedAt(page, /^Oct 1, 2026, 8:00\sAM$/);
  });
});
