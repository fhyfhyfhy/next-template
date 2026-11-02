import { expect, test } from "./demo-backend";

// demo build 提供 Demo（lib/demos.ts），所以首页有指向它们的链接。
test("首页有指向 Demo 的链接", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Next.js 模板" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "查看 Demo" })).toHaveAttribute(
    "href",
    "/demos",
  );
});
