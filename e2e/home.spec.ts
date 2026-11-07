import { expect, test } from "./test";

// 最简单的冒烟测试：生产构建能启动，首页带访问者去全部任务。

test("首页跳到全部任务", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/tasks");
  await expect(
    page.getByRole("heading", { level: 1, name: "全部任务" }),
  ).toBeVisible();
});

test.describe("浏览器语言是英文", () => {
  test.use({ locale: "en-US" });

  test("首页按浏览器语言显示英文，地址不带 locale", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/tasks");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { level: 1, name: "All tasks" }),
    ).toBeVisible();
  });
});
