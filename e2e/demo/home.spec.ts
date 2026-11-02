import { expect, test } from "./mock-api";

// The demo builds serve the demos (lib/demos.ts), so the home page links to
// them.
test("the home page links to the demos", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Next.js 模板" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "查看 Demo" })).toHaveAttribute(
    "href",
    "/demos",
  );
});
