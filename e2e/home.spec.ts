import { expect, test } from "./test";

// 最简单的冒烟测试：生产构建能启动，首页能打开。项目自己的 e2e 都写在 e2e/ 下，e2e/demo/ 留给 Data demo。
test("首页能打开", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
});
