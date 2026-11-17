import type { Locator, Page } from "@playwright/test";

import {
  clickForClientNavigation,
  holdRequests,
  isNavigation,
  openWithoutScripts,
} from "./browser";
import { expect, test } from "./test";

/**
 * 整页打开 UI catalog 的一个地址，等它 hydrate。header 的主题选择在 hydration 之后才可用；页面也把 header 当作
 * Suspense 的 fallback 渲染，它可能在目录到达之前就 hydrate 了：等目录的导航出现，fallback 已经换掉，这时可用的
 * 才是边界里的那个，同一个边界里的 playground 和示例也都已经 hydrate。
 */
async function openUiCatalog(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("navigation", { name: "组件" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "主题" })).toBeEnabled();
}

// 先在 Field 页等到 hydration 完成，再经目录的链接做客户端导航：到达的页面全部由浏览器渲染，
// 之后的点击和输入不会落在还没接上事件的 HTML 上。
async function openComponent(page: Page, id: string, name: string) {
  await openUiCatalog(page, "/ui?component=field");
  await clickForClientNavigation(
    page,
    navigation(page).getByRole("link", { name, exact: true }),
    `/ui?component=${id}`,
  );
  await expect(componentHeading(page, name)).toBeVisible();
}

function navigation(page: Page) {
  return page.getByRole("navigation", { name: "组件" });
}

/** 组件页的标题。标题后的句点只是装饰，不进可访问名称。 */
function componentHeading(scope: Page | Locator, title: string) {
  return scope.getByRole("heading", { level: 1, name: title, exact: true });
}

function playground(page: Page) {
  return page.getByRole("region", { name: "交互实验室" });
}

function controlsPanel(page: Page) {
  return playground(page).getByRole("complementary", { name: "参数面板" });
}

function resetButton(page: Page) {
  return playground(page).getByRole("button", { name: "重置", exact: true });
}

/** 一个使用示例的卡片。卡片的 section 没有名称，不是 region，按它的 h3 标题找。 */
function exampleCard(page: Page, title: string) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { level: 3, name: title, exact: true }),
  });
}

async function openPlaygroundSource(page: Page) {
  await playground(page)
    .getByRole("button", { name: "查看代码", exact: true })
    .click();
  return playground(page).getByRole("region", { name: "playground.tsx 源码" });
}

/** 在 Select 弹出的选项里选一项；弹层渲染在 body 下，不在 trigger 所在的区域里。 */
async function chooseOption(page: Page, combobox: Locator, option: string) {
  await combobox.click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("UI catalog 不让搜索引擎收录，标题接上应用名", async ({ page }) => {
  await page.goto("/ui");

  await expect(page).toHaveTitle("组件 · Next Template");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
});

test("每个组件页都能渲染并 hydrate，不报错", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openUiCatalog(page, "/ui");
  const links = await navigation(page)
    .getByRole("link")
    .evaluateAll((elements) =>
      elements.map((link) => ({
        href: link.getAttribute("href") ?? "",
        title: link.textContent?.trim() ?? "",
      })),
    );
  expect(links.length).toBeGreaterThan(0);

  for (const { href, title } of links) {
    await openUiCatalog(page, href);
    // 标题要是链接对应的组件：链接丢了组件参数时打开的是第一个组件，在这里失败。
    await expect(componentHeading(page, title)).toBeVisible();
    await expect(playground(page)).toBeVisible();
  }
  expect(errors).toStrictEqual([]);
});

test("换组件后立即高亮新的一项，新示例到达前旧示例标记为更新中", async ({
  page,
}) => {
  await openUiCatalog(page, "/ui?component=field");
  // 新组件的示例随导航请求从服务端返回，停住这个请求才看得到它到达之前的样子。
  const release = await holdRequests(page, isNavigation);
  const selectLink = navigation(page).getByRole("link", { name: "Select" });
  const busyHeading = componentHeading(
    page.locator('[aria-busy="true"]'),
    "Field",
  );

  await selectLink.click();

  await expect(selectLink).toHaveAttribute("aria-current", "page");
  await expect(busyHeading).toBeVisible();

  release();
  await expect(page).toHaveURL("/ui?component=select");
  await expect(componentHeading(page, "Select")).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
});

test("Back 回到之前显示的组件", async ({ page }) => {
  await openComponent(page, "select", "Select");

  await page.goBack();

  await expect(page).toHaveURL("/ui?component=field");
  await expect(componentHeading(page, "Field")).toBeVisible();
});

test("Ctrl/Cmd 点击组件在新标签页打开，当前页不变", async ({ page }) => {
  await openUiCatalog(page, "/ui?component=field");
  const selectLink = navigation(page).getByRole("link", {
    name: "Select",
    exact: true,
  });
  const newTab = page.context().waitForEvent("page");

  await selectLink.click({ modifiers: ["ControlOrMeta"] });

  await expect(await newTab).toHaveURL(/\/ui\?component=select$/);
  await expect(selectLink).not.toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL("/ui?component=field");
  await expect(componentHeading(page, "Field")).toBeVisible();
});

test("改参数后画布和源码一起变，重置后一起恢复", async ({ page }) => {
  await openComponent(page, "switch", "Switch");
  const source = await openPlaygroundSource(page);
  await expect(source).toContainText('"label": "自动保存"');

  await playground(page)
    .getByRole("textbox", { name: "label", exact: true })
    .fill("同步保存");

  await expect(
    playground(page).getByRole("switch", { name: "同步保存", exact: true }),
  ).toBeVisible();
  await expect(source).toContainText('"label": "同步保存"');

  await resetButton(page).click();

  await expect(
    playground(page).getByRole("switch", { name: "自动保存", exact: true }),
  ).toBeVisible();
  await expect(source).toContainText('"label": "自动保存"');
});

test("重置也让可调预览自己保存的状态回到初始值", async ({ page }) => {
  await openComponent(page, "button", "Button");
  await playground(page)
    .getByRole("button", { name: "开始创建", exact: true })
    .click();
  await expect(playground(page).getByText("已触发 1 次")).toBeVisible();

  await resetButton(page).click();

  await expect(playground(page).getByText("已触发 0 次")).toBeVisible();
});

test("示例的源码可以展开查看", async ({ page }) => {
  await openComponent(page, "switch", "Switch");

  await page
    .getByRole("button", { name: "基本用法：查看代码", exact: true })
    .click();

  // 只有 basic.example.tsx 里有这句：每个示例都导出 Example，按函数名认不出是哪个文件。
  await expect(
    page.getByRole("region", { name: "basic.example.tsx 源码" }),
  ).toContainText("开启通知");
  await expect(
    page.getByRole("button", { name: "基本用法：收起代码", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
});

test.describe("复制源码", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  // 装上浏览器的假时钟再打开 Switch 页并展开 playground 的源码：时间照常走，用例用 fastForward 跳过按钮复原前的等待。
  async function openSwitchSource(page: Page) {
    await page.clock.install();
    await openComponent(page, "switch", "Switch");
    return openPlaygroundSource(page);
  }

  test("复制的是显示的源码，按钮短暂显示已复制", async ({ page }) => {
    const source = await openSwitchSource(page);

    await playground(page)
      .getByRole("button", { name: "复制代码", exact: true })
      .click();

    await expect(
      playground(page).getByRole("button", { name: "已复制", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await source.textContent(),
    );
    await page.clock.fastForward(3000);
    await expect(
      playground(page).getByRole("button", { name: "复制代码", exact: true }),
    ).toBeVisible();
  });

  test("复制被拒绝时提示手动选择，直到下一次复制", async ({ page }) => {
    // 模拟拒绝写剪贴板的浏览器：第一次写入被拒绝，之后的照常写入。
    await page.addInitScript(() => {
      const write = navigator.clipboard.writeText.bind(navigator.clipboard);
      let refused = false;
      navigator.clipboard.writeText = (text) => {
        if (refused) return write(text);
        refused = true;
        return Promise.reject(
          new DOMException("Write permission denied.", "NotAllowedError"),
        );
      };
    });
    await openSwitchSource(page);
    const failed = playground(page).getByRole("button", {
      name: "复制失败，请手动选择",
      exact: true,
    });

    await playground(page)
      .getByRole("button", { name: "复制代码", exact: true })
      .click();

    await expect(failed).toBeVisible();
    await page.clock.fastForward(3000);
    await expect(failed).toBeVisible();

    await failed.click();
    await expect(
      playground(page).getByRole("button", { name: "已复制", exact: true }),
    ).toBeVisible();
  });
});

test("组件的示例按 order 排列，而不是按文件名", async ({ page }) => {
  await openUiCatalog(page, "/ui?component=button");

  // 按文件名 icon-only.example.tsx 会排在 icons.example.tsx 前面。数组按顺序匹配标题里的一部分。
  await expect(page.getByRole("heading", { level: 3 })).toContainText([
    "基本用法",
    "操作层级与链接",
    "图标尺寸",
    "只有图标",
  ]);
});

test("第一次按 Tab 聚焦跳至组件内容的链接，它显示出来并带焦点环", async ({
  page,
}) => {
  await openUiCatalog(page, "/ui?component=button");

  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "跳至组件内容" });
  await expect(skipLink).toBeFocused();
  // 链接平时是 sr-only 的 1px 方块，Playwright 也算它可见，所以量尺寸。
  await expect
    .poll(async () => (await skipLink.boundingBox())?.height ?? 0)
    .toBeGreaterThan(10);
  await expect(skipLink).not.toHaveCSS("box-shadow", "none");
});

test("进度未知时指示条只占轨道的三分之一，不是满条", async ({ page }) => {
  // 量 playground 的进度条：它的 ProgressIndicator 不带额外的 class，量到的是组件自己的样式。
  await openComponent(page, "progress", "Progress");
  await playground(page)
    .getByRole("switch", { name: "indeterminate", exact: true })
    .click();
  const progress = playground(page).getByRole("progressbar", {
    name: "生成进度",
  });
  // 轨道和指示条没有自己的 role，按 data-slot 量；没显示的量出来是 0。
  const width = async (slot: string) =>
    (await progress.locator(`[data-slot=${slot}]`).boundingBox())?.width ?? 0;

  // 宽度有过渡，等它停下来。
  await expect
    .poll(
      async () =>
        (await width("progress-indicator")) / (await width("progress-track")),
    )
    .toBeCloseTo(1 / 3, 1);
});

for (const { id, title, role, name } of [
  { id: "checkbox", title: "Checkbox", role: "checkbox", name: "接收产品更新" },
  { id: "input", title: "Input", role: "textbox", name: "项目名称" },
  { id: "select", title: "Select", role: "combobox", name: "你的角色" },
] as const) {
  test(`${title} 必填时标出的星号不进控件的名称`, async ({ page }) => {
    await openComponent(page, id, title);

    await controlsPanel(page)
      .getByRole("switch", { name: "required", exact: true })
      .click();

    await expect(
      playground(page).getByText("*", { exact: true }),
    ).toBeVisible();
    await expect(
      playground(page).getByRole(role, { name, exact: true }),
    ).toBeVisible();
  });
}

test("playground 和参数面板的可见标签给控件命名，点 Select 的标签聚焦它的触发器", async ({
  page,
}) => {
  await openComponent(page, "select", "Select");

  await playground(page).getByText("你的角色", { exact: true }).click();
  await expect(
    playground(page).getByRole("combobox", { name: "你的角色", exact: true }),
  ).toBeFocused();

  await controlsPanel(page).getByText("size", { exact: true }).click();
  await expect(
    controlsPanel(page).getByRole("combobox", { name: "size", exact: true }),
  ).toBeFocused();
  await expect(
    controlsPanel(page).getByRole("textbox", { name: "label", exact: true }),
  ).toBeVisible();
});

test("hydration 之前 Form 页的输入框和提交按钮不可用", async ({ page }) => {
  // 服务端渲染的表单在 hydration 之前提交，会变成浏览器原生的 GET 提交、整页刷新。
  const htmlPage = await openWithoutScripts(page, "/ui?component=form");
  await expect(componentHeading(htmlPage, "Form")).toBeVisible();

  const submits = htmlPage.getByRole("button", { name: "提交", exact: true });
  await expect(submits).not.toHaveCount(0);
  for (const submit of await submits.all()) await expect(submit).toBeDisabled();
  for (const name of ["项目名称", "邮箱"]) {
    await expect(
      htmlPage.getByRole("textbox", { name, exact: true }),
    ).toBeDisabled();
  }
  await htmlPage.close();
});

test("Form 示例显示自己写的错误文案，提交成功后地址不变", async ({ page }) => {
  await openUiCatalog(page, "/ui?component=form");
  const form = exampleCard(page, "基本用法");
  const email = form.getByRole("textbox", { name: "邮箱", exact: true });
  const submit = form.getByRole("button", { name: "提交", exact: true });
  // 提交按钮在这个表单 hydrate 之后才可用。
  await expect(submit).toBeEnabled();

  await submit.click();
  await expect(form.getByText("请输入邮箱", { exact: true })).toBeVisible();
  // 提交过一次以后，每次改动都重新校验。
  await email.fill("abc");
  await expect(form.getByText("邮箱格式不正确", { exact: true })).toBeVisible();
  await email.fill("someone@example.com");
  await submit.click();

  await expect(form.getByRole("status")).toHaveText(
    "已提交：someone@example.com",
  );
  await expect(page).toHaveURL("/ui?component=form");
});

test("Form playground 显示自己写的错误文案，mode 决定第一次提交之前什么时候校验", async ({
  page,
}) => {
  await openUiCatalog(page, "/ui?component=form");
  const name = playground(page).getByRole("textbox", {
    name: "项目名称",
    exact: true,
  });
  const submit = playground(page).getByRole("button", {
    name: "提交",
    exact: true,
  });
  const tooShort = playground(page).getByText("至少 3 个字", { exact: true });
  await expect(submit).toBeEnabled();

  await submit.click();
  await expect(
    playground(page).getByText("请输入项目名称", { exact: true }),
  ).toBeVisible();
  await name.fill("ab");
  await expect(tooShort).toBeVisible();

  // 重置后表单重新开始。mode 是 submit：第一次提交之前输入不校验。
  await resetButton(page).click();
  await name.fill("ab");
  await expect(name).toHaveValue("ab");
  await expect(tooShort).toHaveCount(0);
  await submit.click();
  await expect(tooShort).toBeVisible();

  // mode 是 change：第一次提交之前边输入边校验。
  await resetButton(page).click();
  await chooseOption(
    page,
    controlsPanel(page).getByRole("combobox", { name: "mode", exact: true }),
    "change",
  );
  await name.fill("ab");
  await expect(tooShort).toBeVisible();
});

test("改 Field 的 description 参数，画布上的说明和源码一起变", async ({
  page,
}) => {
  await openUiCatalog(page, "/ui?component=field");
  const source = await openPlaygroundSource(page);

  await controlsPanel(page)
    .getByRole("textbox", { name: "description", exact: true })
    .fill("只有团队成员能看到");

  await expect(
    playground(page).getByText("只有团队成员能看到", { exact: true }),
  ).toBeVisible();
  await expect(
    playground(page).getByRole("textbox", { name: "项目名称", exact: true }),
  ).toHaveAccessibleDescription(/只有团队成员能看到/);
  await expect(source).toContainText('"description": "只有团队成员能看到"');
});

test("服务端拒绝的名称显示在字段下，改动后清除；空名称在浏览器里就拦下", async ({
  page,
}) => {
  await openUiCatalog(page, "/ui?component=field");
  const form = exampleCard(page, "服务端返回的字段错误");
  const name = form.getByRole("textbox", { name: "名称", exact: true });
  const save = form.getByRole("button", { name: "保存", exact: true });
  const taken = form.getByText("名称已被其他任务占用", { exact: true });
  await expect(save).toBeEnabled();
  await expect(name).toHaveValue("低多边形狐狸");

  await save.click();
  await expect(taken).toBeVisible();
  await name.fill("低多边形狐狸 2");
  await expect(taken).toHaveCount(0);

  await name.fill("");
  await save.click();
  await expect(form.getByText("请输入名称", { exact: true })).toBeVisible();
});

test("Textarea 的参数控制行数、无效和禁用，说明经 aria-describedby 关联", async ({
  page,
}) => {
  await openComponent(page, "textarea", "Textarea");
  const textarea = playground(page).getByRole("textbox", {
    name: "项目简介",
    exact: true,
  });
  await expect(textarea).toHaveAccessibleDescription(
    "显示在项目主页的名称下面。",
  );
  await expect(textarea).toHaveAttribute("rows", "3");

  await chooseOption(
    page,
    controlsPanel(page).getByRole("combobox", { name: "rows", exact: true }),
    "8",
  );
  await expect(textarea).toHaveAttribute("rows", "8");

  await controlsPanel(page)
    .getByRole("switch", { name: "invalid", exact: true })
    .click();
  await expect(textarea).toHaveAttribute("aria-invalid", "true");

  await controlsPanel(page)
    .getByRole("switch", { name: "disabled", exact: true })
    .click();
  await expect(textarea).toBeDisabled();
});
