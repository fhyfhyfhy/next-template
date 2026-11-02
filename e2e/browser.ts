import type { Page } from "@playwright/test";

/**
 * 模拟用户切回这个标签页。Playwright 的页面始终在前台，没有切换可见性的 API，只能派发事件；
 * 照着浏览器的真实事件在 document 上派发并冒泡，React Query 的 focusManager 在 window 上监听。
 */
export async function returnToTab(page: Page) {
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true })),
  );
}
