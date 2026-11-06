import { expect, test } from "./test";

test("目录不让搜索引擎收录，标题接上应用名", async ({ page }) => {
  await page.goto("/ui");

  await expect(page).toHaveTitle("组件 · Next Template");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
});
