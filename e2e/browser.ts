import type { Page } from "@playwright/test";

/**
 * Simulates the user returning to this tab. Playwright pages stay in the
 * foreground and have no API to change visibility, so all a test can do is
 * dispatch the event. Like the browser's real one, it fires on document and
 * bubbles: React Query's focusManager listens on window.
 */
export async function returnToTab(page: Page) {
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true })),
  );
}
