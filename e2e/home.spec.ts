import { expect, test } from "./test";

// The smoke test: the production build starts and the home page opens. The
// project's own e2e specs go in e2e/; e2e/demo/ is for the Data demo.
test("the home page opens", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
});
