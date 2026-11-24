import type { Locator, Page } from "@playwright/test";

import {
  clickForClientNavigation,
  expectNativelyDisabled,
  expectTextContrast,
  holdRequests,
  isNavigation,
  openWithoutScripts,
} from "./browser";
import { expect, test } from "./test";

/**
 * 整页打开 UI catalog 的一个地址，等它 hydrate。header 的主题选择在 hydration 之后才可用；`app/[locale]/ui/page.tsx`
 * 也把 header 当作 Suspense 的 fallback 渲染，它可能在目录到达之前就 hydrate 了：等目录的导航出现，fallback 已经换掉，
 * 这时可用的才是边界里的那个，同一个边界里的 playground 和示例也都已经 hydrate。
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

/** 页面上的使用示例卡片。卡片的 section 没有名称，不是 region，按带 h3 标题的 section 找。 */
function exampleCards(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 3 }) });
}

/** 标题为 `title` 的使用示例卡片。 */
function exampleCard(page: Page, title: string) {
  return exampleCards(page).filter({
    has: page.getByRole("heading", { level: 3, name: title, exact: true }),
  });
}

/** playground 展开源码的按钮。名称固定为“代码”，展开与否由 aria-expanded 表示。 */
function playgroundCodeToggle(page: Page) {
  return playground(page).getByRole("button", { name: "代码", exact: true });
}

function playgroundSource(page: Page) {
  return playground(page).getByRole("region", { name: "playground.tsx 源码" });
}

/** 展开 playground 的源码并返回它。 */
async function openPlaygroundSource(page: Page) {
  await playgroundCodeToggle(page).click();
  return playgroundSource(page);
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

for (const { colorScheme, theme } of [
  { colorScheme: "light", theme: "浅色" },
  { colorScheme: "dark", theme: "深色" },
] as const) {
  test(`${theme}主题里，组件目录当前项的文字和它叠出来的背景对比度不低于 4.5:1`, async ({
    page,
  }) => {
    // 主题默认跟随系统。
    await page.emulateMedia({ colorScheme });
    await openUiCatalog(page, "/ui?component=button");
    const current = navigation(page).getByRole("link", {
      name: "Button",
      exact: true,
    });
    await expect(current).toHaveAttribute("aria-current", "page");

    await expectTextContrast(current);
  });
}

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

test("playground 的源码可以展开查看，代码按钮的名称不变，由 aria-expanded 表示展开", async ({
  page,
}) => {
  await openComponent(page, "switch", "Switch");
  const toggle = playgroundCodeToggle(page);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();

  await expect(playgroundSource(page)).toContainText('"label": "自动保存"');
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("示例的源码可以展开查看，按钮的名称不变，由 aria-expanded 表示展开", async ({
  page,
}) => {
  await openComponent(page, "switch", "Switch");
  const toggle = page.getByRole("button", {
    name: "基本用法：代码",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();

  // 只有 basic.example.tsx 里有这句：每个示例都导出 Example，按函数名认不出是哪个文件。
  await expect(
    page.getByRole("region", { name: "basic.example.tsx 源码" }),
  ).toContainText("开启通知");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test.describe("复制源码", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  // 装上浏览器的假时钟再打开 Switch 页并展开 playground 的源码：时间照常走，用例用 fastForward 跳过按钮复原前的等待。
  async function openSwitchSource(page: Page) {
    await page.clock.install();
    await openComponent(page, "switch", "Switch");
    return openPlaygroundSource(page);
  }

  /** 模拟拒绝写剪贴板的浏览器：前 `refusals` 次写入被拒绝，之后的照常写入。 */
  async function refuseClipboardWrites(page: Page, refusals: number) {
    await page.addInitScript((count) => {
      const write = navigator.clipboard.writeText.bind(navigator.clipboard);
      let remaining = count;
      navigator.clipboard.writeText = (text) => {
        if (remaining === 0) return write(text);
        remaining -= 1;
        return Promise.reject(
          new DOMException("Write permission denied.", "NotAllowedError"),
        );
      };
    }, refusals);
  }

  /**
   * 模拟没有剪贴板 API 的浏览器，比如非 https 地址上的页面。clipboard 是 Navigator.prototype 上的 getter，
   * 删掉它 `"clipboard" in navigator` 才是 false；只把它设成 undefined，复制时会同步抛 TypeError。
   */
  async function removeClipboard(page: Page) {
    await page.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, "clipboard");
    });
  }

  function copyButton(page: Page) {
    return playground(page).getByRole("button", {
      name: "复制代码",
      exact: true,
    });
  }

  function copyStatus(page: Page) {
    return playground(page).getByRole("status");
  }

  test("复制的是显示的源码，按钮短暂显示已复制", async ({ page }) => {
    const source = await openSwitchSource(page);

    await copyButton(page).click();

    await expect(
      playground(page).getByRole("button", { name: "已复制", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await source.textContent(),
    );
    await page.clock.fastForward(3000);
    await expect(copyButton(page)).toBeVisible();
  });

  test("复制被拒绝时按钮旁的状态行提示手动复制，按钮名称不变", async ({
    page,
  }) => {
    await refuseClipboardWrites(page, 1);
    await openSwitchSource(page);

    await copyButton(page).click();

    await expect(copyStatus(page)).toHaveText("复制失败，请手动选中代码后复制");
    await expect(copyButton(page)).toBeVisible();
  });

  test("复制失败的提示不随按钮复原的计时消失", async ({ page }) => {
    await refuseClipboardWrites(page, 1);
    await openSwitchSource(page);
    await copyButton(page).click();
    await expect(copyStatus(page)).toHaveText("复制失败，请手动选中代码后复制");

    await page.clock.fastForward(3000);

    await expect(copyStatus(page)).toHaveText("复制失败，请手动选中代码后复制");
  });

  for (const { browser, setUp } of [
    {
      browser: "剪贴板写入被拒绝",
      setUp: (page: Page) => refuseClipboardWrites(page, 2),
    },
    // 这时 copy() 同步记下失败，清空和写入要分在两次渲染里。
    { browser: "没有剪贴板 API", setUp: removeClipboard },
  ]) {
    test(`${browser}时，再次失败的提示先清空再写入，读屏重新播报`, async ({
      page,
    }) => {
      await setUp(page);
      await openSwitchSource(page);
      const status = copyStatus(page);
      await copyButton(page).click();
      await expect(status).toHaveText("复制失败，请手动选中代码后复制");
      await status.evaluate((element) => {
        const texts: string[] = [];
        Object.assign(globalThis, { statusTexts: texts });
        new MutationObserver(() => texts.push(element.textContent)).observe(
          element,
          { childList: true, characterData: true, subtree: true },
        );
      });

      await copyButton(page).click();

      // 文字从无到有，读屏才会重新播报。
      await expect
        .poll(() => page.evaluate(() => Reflect.get(globalThis, "statusTexts")))
        .toStrictEqual(["", "复制失败，请手动选中代码后复制"]);
    });
  }

  test("复制失败后再复制成功，状态行清空", async ({ page }) => {
    await refuseClipboardWrites(page, 1);
    await openSwitchSource(page);
    await copyButton(page).click();
    await expect(copyStatus(page)).toHaveText("复制失败，请手动选中代码后复制");

    await copyButton(page).click();

    await expect(
      playground(page).getByRole("button", { name: "已复制", exact: true }),
    ).toBeVisible();
    await expect(copyStatus(page)).toHaveText("");
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

/**
 * 打开 Progress 页，把 playground 的进度条切成进度未知并返回它。用 playground 的进度条：它的 ProgressIndicator
 * 不带额外的 class，量到的是组件自己的样式。轨道和指示条没有自己的 role，用例按 data-slot 找。
 */
async function openIndeterminateProgress(page: Page) {
  await openComponent(page, "progress", "Progress");
  await playground(page)
    .getByRole("switch", { name: "indeterminate", exact: true })
    .click();
  return playground(page).getByRole("progressbar", { name: "生成进度" });
}

test("进度未知时指示条只占轨道的三分之一，不是满条", async ({ page }) => {
  const progress = await openIndeterminateProgress(page);
  // 没显示的量出来是 0。
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

test("进度未知时指示条播放滑动动画", async ({ page }) => {
  const indicator = (await openIndeterminateProgress(page)).locator(
    "[data-slot=progress-indicator]",
  );

  // 切换时宽度的过渡也算一个 running 的动画，只认一直循环的那个。
  await expect
    .poll(() =>
      indicator.evaluate((element) =>
        element
          .getAnimations()
          .some(
            (animation) =>
              animation.playState === "running" &&
              animation.effect?.getTiming().iterations === Infinity,
          ),
      ),
    )
    .toBe(true);
  await expect(indicator).not.toHaveCSS("animation-duration", "0s");
});

test("减少动效时，进度未知的指示条静止在轨道中间，不贴着左端", async ({
  page,
}) => {
  // 减少动效时动画时长归零，指示条停在不带动画时的位置；贴着左端时它像完成了三分之一的进度。
  await page.emulateMedia({ reducedMotion: "reduce" });
  const progress = await openIndeterminateProgress(page);
  const box = (slot: string) =>
    progress.locator(`[data-slot=${slot}]`).boundingBox();
  // 先确认没有动画，下面量到的才是停住的位置，不是滑动中碰巧经过中间的一帧。
  await expect(progress.locator("[data-slot=progress-indicator]")).toHaveCSS(
    "animation-duration",
    "0s",
  );

  // 指示条的宽度由“进度未知时指示条只占轨道的三分之一，不是满条”量，这里比较它左右两边到轨道的距离。
  await expect
    .poll(async () => {
      const track = await box("progress-track");
      const indicator = await box("progress-indicator");
      if (!track || !indicator) return Number.POSITIVE_INFINITY;
      const left = indicator.x - track.x;
      const right = track.x + track.width - (indicator.x + indicator.width);
      return Math.abs(left - right);
    })
    .toBeLessThanOrEqual(1);
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

test("hydration 之前 Form 页示例和 playground 的输入框与提交按钮不可用", async ({
  page,
}) => {
  // 服务端渲染的表单在 hydration 之前提交，会变成浏览器原生的 GET 提交、整页刷新。
  const htmlPage = await openWithoutScripts(page, "/ui?component=form");
  await expect(componentHeading(htmlPage, "Form")).toBeVisible();

  const forms = playground(htmlPage).or(exampleCards(htmlPage));
  const submits = forms.getByRole("button", { name: "提交", exact: true });
  const textboxes = forms.getByRole("textbox");
  await expect(submits).not.toHaveCount(0);
  await expect(textboxes).not.toHaveCount(0);
  for (const control of [
    ...(await submits.all()),
    ...(await textboxes.all()),
  ]) {
    await expectNativelyDisabled(control);
  }
  await htmlPage.close();
});

test("hydration 之前 Input 页的受控输入框不可用", async ({ page }) => {
  // 受控输入框在 hydration 之前输入的字会被 hydration 盖掉。
  const htmlPage = await openWithoutScripts(page, "/ui?component=input");
  await expect(componentHeading(htmlPage, "Input")).toBeVisible();

  for (const textbox of [
    playground(htmlPage).getByRole("textbox", {
      name: "项目名称",
      exact: true,
    }),
    exampleCard(htmlPage, "受控输入与校验").getByRole("textbox", {
      name: "用户名",
      exact: true,
    }),
    controlsPanel(htmlPage).getByRole("textbox", {
      name: "label",
      exact: true,
    }),
  ]) {
    await expectNativelyDisabled(textbox);
  }
  await htmlPage.close();
});

/** 打开 Form 页，等“聚焦第一个无效字段”示例 hydrate：它的提交按钮在 hydration 之后才可用。 */
async function openFirstInvalidExample(page: Page) {
  await openUiCatalog(page, "/ui?component=form");
  const form = exampleCard(page, "聚焦第一个无效字段");
  const submit = form.getByRole("button", { name: "提交", exact: true });
  await expect(submit).toBeEnabled();
  return {
    form,
    team: form.getByRole("combobox", { name: "团队", exact: true }),
    email: form.getByRole("textbox", { name: "邮箱", exact: true }),
    submit,
  };
}

test("Form 提交失败时焦点移到第一个无效字段可见的控件上，第一次提交也一样", async ({
  page,
}) => {
  const { form, team, submit } = await openFirstInvalidExample(page);

  // 第一次提交时字段还没校验过，Form 放行，TanStack Form 校验后才有无效字段。焦点越过填好的名称，落在第一个
  // 无效字段“团队”可见的触发器上：留在按钮、落到 Select 给原生提交渲染的隐藏 input（带 aria-hidden，不算
  // combobox）或后面同样无效的邮箱上，这里都不通过。
  await submit.click();
  await expect(team).toBeFocused();

  // 字段已经无效时，Form 在调用 onSubmit 之前拦下提交，同样聚焦。
  await form.getByRole("textbox", { name: "名称", exact: true }).click();
  await submit.click();
  await expect(team).toBeFocused();
});

test("Form 示例显示自己写的错误文案，提交成功后地址不变", async ({ page }) => {
  const { form, team, email, submit } = await openFirstInvalidExample(page);

  await submit.click();
  await expect(form.getByText("请选择团队", { exact: true })).toBeVisible();
  await expect(form.getByText("请输入邮箱", { exact: true })).toBeVisible();
  // 提交过一次以后，每次改动都重新校验。
  await email.fill("abc");
  await expect(form.getByText("邮箱格式不正确", { exact: true })).toBeVisible();
  await email.fill("someone@example.com");
  await chooseOption(page, team, "设计组");
  await submit.click();

  await expect(form.getByRole("status")).toHaveText("已提交");
  await expect(page).toHaveURL("/ui?component=form");
});

test("Form 示例提交成功后，再次提交被拦下时状态行清空", async ({ page }) => {
  const { form, team, email, submit } = await openFirstInvalidExample(page);
  await chooseOption(page, team, "设计组");
  await email.fill("someone@example.com");
  await submit.click();
  await expect(form.getByRole("status")).toHaveText("已提交");
  await email.fill("abc");
  await expect(form.getByText("邮箱格式不正确", { exact: true })).toBeVisible();

  await submit.click();

  await expect(form.getByRole("status")).toHaveText("");
});

for (const { component, title, scope } of [
  {
    component: "form",
    title: "Form 的“聚焦第一个无效字段”示例",
    scope: (page: Page) => exampleCard(page, "聚焦第一个无效字段"),
  },
  { component: "form", title: "Form playground ", scope: playground },
  {
    component: "field",
    title: "Field 的“配合 TanStack Form”示例",
    scope: (page: Page) => exampleCard(page, "配合 TanStack Form"),
  },
  {
    component: "field",
    title: "Field 的“服务端返回的字段错误”示例",
    scope: (page: Page) => exampleCard(page, "服务端返回的字段错误"),
  },
]) {
  test(`${title}的状态行在提交之前就挂着，内容为空`, async ({ page }) => {
    await openUiCatalog(page, `/ui?component=${component}`);

    // 和文字一起挂载的 role="status" 读屏可能不播报，所以它在提交之前就要在。
    await expect(scope(page).getByRole("status")).toHaveText("");
  });
}

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

  // mode 是 blur：第一次提交之前，离开输入框时才校验。
  await resetButton(page).click();
  await chooseOption(
    page,
    controlsPanel(page).getByRole("combobox", { name: "mode", exact: true }),
    "blur",
  );
  await name.fill("ab");
  await expect(name).toHaveValue("ab");
  await expect(tooShort).toHaveCount(0);
  await name.blur();
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

test.describe("服务端返回的字段错误", () => {
  // 打开 Field 页，等这个示例 hydrate；名称的初始值就是服务端会拒绝的名称。
  async function openServerErrorsExample(page: Page) {
    await openUiCatalog(page, "/ui?component=field");
    const form = exampleCard(page, "服务端返回的字段错误");
    const name = form.getByRole("textbox", { name: "名称", exact: true });
    const save = form.getByRole("button", { name: "保存", exact: true });
    await expect(save).toBeEnabled();
    await expect(name).toHaveValue("低多边形狐狸");
    return { form, name, save };
  }

  test("服务端拒绝的名称显示在字段下，改动后清除", async ({ page }) => {
    const { form, name, save } = await openServerErrorsExample(page);
    const taken = form.getByText("名称已被其他任务占用", { exact: true });

    await save.click();
    await expect(taken).toBeVisible();
    await name.fill("低多边形狐狸 2");

    await expect(taken).toHaveCount(0);
  });

  test("服务端拒绝名称后焦点移到名称字段", async ({ page }) => {
    const { name, save } = await openServerErrorsExample(page);

    await save.click();

    // 错误在 onSubmit 的 Promise 结束之前写回，Form 随后聚焦这个字段。
    await expect(name).toBeFocused();
  });

  test("名称为空时显示浏览器里 schema 校验的错误", async ({ page }) => {
    const { form, name, save } = await openServerErrorsExample(page);

    await name.fill("");
    await save.click();

    await expect(form.getByText("请输入名称", { exact: true })).toBeVisible();
  });
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

for (const { id, title, name } of [
  { id: "input", title: "Input", name: "项目名称" },
  { id: "textarea", title: "Textarea", name: "项目简介" },
]) {
  test(`无效的 ${title} 聚焦时显示焦点环，不被无效样式盖住`, async ({
    page,
  }) => {
    await openComponent(page, id, title);
    await controlsPanel(page)
      .getByRole("switch", { name: "invalid", exact: true })
      .click();
    const field = playground(page).getByRole("textbox", { name, exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");

    await field.focus();

    // 无效时 destructive 色的边框盖住了聚焦时的 border-ring，焦点环要用不透明的 --ring，而不是普通状态那层
    // ring-ring/15 的淡色。--ring 借一个元素的 color 解析成计算值，和 box-shadow 里的颜色是同一种写法。
    const ring = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--ring)";
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    // box-shadow 有过渡，等它停在最终的颜色上。
    await expect
      .poll(() =>
        field.evaluate((element) => getComputedStyle(element).boxShadow),
      )
      .toContain(ring);
  });
}

test("Checkbox 勾选校验的错误关联到复选框，勾选后清除", async ({ page }) => {
  await openUiCatalog(page, "/ui?component=checkbox");
  const checkbox = exampleCard(page, "勾选校验").getByRole("checkbox", {
    name: "我已阅读并同意使用条款",
    exact: true,
  });
  await expect(checkbox).toHaveAccessibleDescription("请先同意使用条款。");

  await checkbox.click();

  await expect(checkbox).toHaveAccessibleDescription("");
});

test("Switch playground 的说明关联到开关", async ({ page }) => {
  await openUiCatalog(page, "/ui?component=switch");

  await expect(
    playground(page).getByRole("switch", { name: "自动保存", exact: true }),
  ).toHaveAccessibleDescription("修改内容后自动保存到云端。");
});

test("Input 的说明和错误关联到输入框", async ({ page }) => {
  await openUiCatalog(page, "/ui?component=input");
  await expect(
    playground(page).getByRole("textbox", { name: "项目名称", exact: true }),
  ).toHaveAccessibleDescription("给你的下一个想法起个名字。");
  const username = exampleCard(page, "受控输入与校验").getByRole("textbox", {
    name: "用户名",
    exact: true,
  });
  await expect(username).toHaveAccessibleDescription("用于显示在个人主页。");

  await username.fill("ab");

  // 说明和错误都在 aria-describedby 里，各自出现在描述中。
  await expect(username).toHaveAccessibleDescription(/用于显示在个人主页。/);
  await expect(username).toHaveAccessibleDescription(/用户名至少需要 3 个字。/);
});

test("Toaster 的关闭按钮用界面语言命名", async ({ page }) => {
  await openUiCatalog(page, "/ui?component=toaster");
  await controlsPanel(page)
    .getByRole("switch", { name: "closeButton", exact: true })
    .click();

  await playground(page)
    .getByRole("button", { name: "显示提示", exact: true })
    .click();

  // 通知渲染在根布局的 Toaster 里，不在 playground 的区域内。
  await expect(
    page.getByRole("button", { name: "关闭通知", exact: true }),
  ).toBeVisible();
});
