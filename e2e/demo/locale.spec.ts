import { expect, test } from "./mock-api";

// The routing rules are in docs/adr/0002-locale-routing-as-needed-prefix.md:
// the default locale (zh) has no prefix, and en lives under /en.
// The Playwright configs set the browser's language to zh-CN; the tests below
// that need an English browser set it themselves.

test("en pages live under /en and render wholly in English", async ({
  page,
}) => {
  await page.goto("/en/demos");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("link", { name: /Data demo · All tasks/ }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Demo · Next Demo");
});

test("switching the language stays on the same page, and an unprefixed URL opened later remembers the pick", async ({
  page,
}) => {
  await page.goto("/demos/ui?component=select");
  const switcher = page.getByRole("navigation", { name: "切换语言" });
  // The switcher's links render only in the browser (prerendering gives text
  // that cannot be clicked), so finding a link means the page has hydrated.
  await expect(switcher.getByRole("link", { name: "English" })).toBeVisible();
  await switcher.getByRole("link", { name: "English" }).click();

  await expect(page).toHaveURL("/en/demos/ui?component=select");
  await expect(page.getByRole("heading", { name: "Select." })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Usage examples" }),
  ).toBeVisible();

  await page.goto("/demos");
  await expect(page).toHaveURL("/en/demos");

  const englishSwitcher = page.getByRole("navigation", { name: "Language" });
  await expect(
    englishSwitcher.getByRole("link", { name: "中文" }),
  ).toBeVisible();
  await englishSwitcher.getByRole("link", { name: "中文" }).click();
  await expect(page).toHaveURL("/demos");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");

  await page.goto("/demos");
  await expect(page).toHaveURL("/demos");
});

test("an unsupported locale prefix answers 404", async ({ request }) => {
  const response = await request.get("/fr/demos");
  expect(response.status()).toBe(404);
});

test.describe("with an English browser", () => {
  test.use({ locale: "en-US" });

  test("the first visit to an unprefixed URL goes to /en", async ({ page }) => {
    await page.goto("/demos");
    await expect(page).toHaveURL("/en/demos");
  });
});
