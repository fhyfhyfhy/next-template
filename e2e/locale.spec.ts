import { expect, test } from "./test";

// 规则见 docs/adr/0005-unprefixed-urls-in-visitor-locale.md：URL 不带 locale，页面按语言切换器记下的选择显示，
// 没选过时按浏览器语言。Playwright 配置把浏览器语言设成 zh-CN，需要英文浏览器的用例单独设置。

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

test("切换语言后地址不变，之后的客户端导航和整页打开都按选择显示", async ({
  page,
}) => {
  await page.goto("/search");
  const switcher = page.getByRole("navigation", { name: "切换语言" });
  // 切换器的链接是整页跳转的 <a>，不用等 hydrate。
  await expect(switcher.getByRole("link", { name: "English" })).toBeVisible();
  await switcher.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL("/search");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  // 客户端导航：地址和中文页面相同，拿到的要是英文页面。徽标只在浏览器里渲染，出现说明已经 hydrate。
  await expect(page.getByLabel(/^\d+ tasks? in progress$/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "All tasks" })
    .click();
  await expect(page).toHaveURL("/tasks");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "All tasks.",
  );

  await page.goto("/ui?component=select");
  await expect(page.getByRole("heading", { name: "Select." })).toBeVisible();
  const englishSwitcher = page.getByRole("navigation", { name: "Language" });
  await expect(
    englishSwitcher.getByRole("link", { name: "中文" }),
  ).toBeVisible();
  await englishSwitcher.getByRole("link", { name: "中文" }).click();
  await expect(page).toHaveURL("/ui?component=select");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
});

test("带 locale 前缀的地址记下选择，跳到不带前缀的地址，选择保留一年", async ({
  page,
  context,
}) => {
  await page.goto("/en/tasks");
  await expect(page).toHaveURL("/tasks");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  const cookie = (await context.cookies()).find(
    ({ name }) => name === "NEXT_LOCALE",
  );
  expect(cookie?.value).toBe("en");
  expect(cookie?.expires).toBeGreaterThan(
    (Date.now() + ONE_YEAR_MS) / 1000 - 60,
  );

  await page.goto("/ui");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("不支持的 locale 前缀返回 404", async ({ request }) => {
  const response = await request.get("/fr/tasks");
  expect(response.status()).toBe(404);
});

test.describe("浏览器语言是英文", () => {
  test.use({ locale: "en-US" });

  test("没选过语言时按浏览器语言显示，不记成选择", async ({
    page,
    context,
  }) => {
    await page.goto("/tasks");
    await expect(page).toHaveURL("/tasks");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "All tasks.",
    );
    await expect(page).toHaveTitle("All tasks · Next Template");
    expect((await context.cookies()).map(({ name }) => name)).not.toContain(
      "NEXT_LOCALE",
    );
  });

  test("选了中文之后，之后的页面都显示中文", async ({ page }) => {
    await page.goto("/tasks");
    const switcher = page.getByRole("navigation", { name: "Language" });
    await expect(switcher.getByRole("link", { name: "中文" })).toBeVisible();
    await switcher.getByRole("link", { name: "中文" }).click();
    await expect(page).toHaveURL("/tasks");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");

    await page.goto("/ui?component=select");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  });
});
