import { expect, test } from "./test";

// The smoke test: the production build starts and serves the placeholder home
// page. It serves no demos (lib/demos.ts), so the page has no link to them.
// The project's own e2e specs go in e2e/; e2e/demo/ is for the demos.
test("the home page shows the placeholder, with no link to the demos", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Next.js 模板" }),
  ).toBeVisible();
  await expect(page.getByRole("link")).toHaveCount(0);
});

test("the English home page lives under /en", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { level: 1, name: "Next.js template" }),
  ).toBeVisible();
});
