import { holdRequests, isNavigation } from "./browser";
import { expect, test } from "./test";

test("UI catalog 不让搜索引擎收录，标题接上应用名", async ({ page }) => {
  await page.goto("/ui");

  await expect(page).toHaveTitle("组件 · Next Template");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
});

test("换组件后立即高亮新的一项，新示例到达前旧示例标记为更新中", async ({
  page,
}) => {
  await page.goto("/ui?component=field");
  // 示例表单的提交按钮在 hydration 之后才可用，和目录在同一个 Suspense 里。
  await expect(
    page.getByRole("button", { name: "提交", exact: true }),
  ).toBeEnabled();
  // 新组件的示例随导航请求从服务端返回，停住这个请求才看得到它到达之前的样子。
  const release = await holdRequests(page, isNavigation);
  const selectLink = page
    .getByRole("navigation", { name: "组件" })
    .getByRole("link", { name: "Select" });
  const busyHeading = page
    .locator('[aria-busy="true"]')
    .getByRole("heading", { level: 1, name: "Field" });

  await selectLink.click();

  await expect(selectLink).toHaveAttribute("aria-current", "page");
  await expect(busyHeading).toBeVisible();

  release();
  await expect(page).toHaveURL("/ui?component=select");
  await expect(
    page.getByRole("heading", { level: 1, name: "Select" }),
  ).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
});
