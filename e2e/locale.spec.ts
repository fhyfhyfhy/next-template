import { expect, test } from "./test";

// 路由规则见 docs/adr/0002-locale-routing-as-needed-prefix.md：默认 locale（zh）不带前缀，en 在 /en 下。
// playwright.config.ts 把浏览器的语言设成 zh-CN，下面需要英文浏览器的用例单独设置。

test("en 的页面带 /en 前缀，整页渲染英文", async ({ page }) => {
  await page.goto("/en/demos");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("link", { name: /Data demo · All tasks/ }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Demo · Next Demo");
});

test("切换语言后停在同一页面，再打开不带前缀的地址时记得选择", async ({
  page,
}) => {
  await page.goto("/demos/ui?component=select");
  const switcher = page.getByRole("navigation", { name: "切换语言" });
  // 切换器的链接只在浏览器里渲染（预渲染时是不可点的文字），找到链接说明已经 hydrate。
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

test("不支持的 locale 前缀返回 404", async ({ request }) => {
  const response = await request.get("/fr/demos");
  expect(response.status()).toBe(404);
});

test.describe("浏览器语言是英文", () => {
  test.use({ locale: "en-US" });

  test("第一次打开不带前缀的地址时跳到 /en", async ({ page }) => {
    await page.goto("/demos");
    await expect(page).toHaveURL("/en/demos");
  });
});
