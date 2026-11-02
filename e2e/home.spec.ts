import { expect, test } from "./test";

// 最简单的冒烟测试：生产构建能启动，首页显示占位内容。生产构建不提供 Demo（lib/demos.ts），所以首页没有指向它们的链接。
// 项目自己的 e2e 都写在 e2e/ 下，e2e/demo/ 留给 Demo。
test("首页显示占位内容，没有指向 Demo 的链接", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Next.js 模板" }),
  ).toBeVisible();
  await expect(page.getByRole("link")).toHaveCount(0);
});

test("英文首页在 /en 下", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { level: 1, name: "Next.js template" }),
  ).toBeVisible();
});
