import type { Locator, Page, Request, Route } from "@playwright/test";

import { expect } from "./test";

/**
 * 模拟用户切回这个标签页。Playwright 的页面始终在前台，没有切换可见性的 API，只能派发事件；
 * 照着浏览器的真实事件在 document 上派发并冒泡，React Query 的 focusManager 在 window 上监听。
 */
export async function returnToTab(page: Page) {
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true })),
  );
}

/** 浏览器调用 Server Action 的请求：POST 到当前页面的地址，带 `Next-Action` 头。 */
export function isServerAction(request: Request) {
  return (
    request.method() === "POST" &&
    request.headers()["next-action"] !== undefined
  );
}

/** 请求的是应用自己的这个路径（不含 query）。 */
export function hasPath(path: string) {
  return (request: Request) => new URL(request.url()).pathname === path;
}

/**
 * 从现在起记下浏览器发出的、符合 `match` 的请求。断言“没有发请求”时，在操作之前开始记录，等界面回应之后再检查。
 */
export function recordRequests(
  page: Page,
  match: (request: Request) => boolean,
) {
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (match(request)) requests.push(request);
  });
  return requests;
}

/** 请求体里有 `text`，比如任务 id：页面上同时有别的 Server Action 时（列表页的变化信号），用它认出要等的那一个。 */
export function requestBodyIncludes(text: string) {
  return (request: Request) => (request.postData() ?? "").includes(text);
}

/** 等下一个 Server Action 的响应，`match` 进一步挑出是哪一个。Server Action 返回时，服务端已经写入、缓存已经失效。 */
export function waitForServerAction(
  page: Page,
  match: (request: Request) => boolean = () => true,
) {
  return page.waitForResponse(
    (response) =>
      isServerAction(response.request()) && match(response.request()),
  );
}

/** 客户端导航向服务端要新页面的请求（RSC 请求），不包括预取。 */
export function isNavigation(request: Request) {
  const headers = request.headers();
  return headers.rsc === "1" && headers["next-router-prefetch"] === undefined;
}

/**
 * 让之后匹配的请求晚 `ms` 毫秒才发到服务端，模拟慢网络或慢服务：用来看到响应返回之前的界面。
 * 只影响浏览器发出的请求；服务端渲染时读数据库的耗时，用 e2e/backend.ts 的 `holdTable` 拖慢。
 */
export async function delayRequests(
  page: Page,
  match: (request: Request) => boolean,
  ms: number,
) {
  await page.route("**/*", async (route) => {
    if (match(route.request())) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
    await route.fallback();
  });
}

/**
 * 让之后匹配的请求停在浏览器里，直到调用返回的函数才发出：放行之前界面上只有乐观更新，断言不用和时间赛跑。
 * 放行后交给先注册的拦截处理，比如 `failRequests`，没有就照常发出；放行之后的请求不再停。
 */
export async function holdRequests(
  page: Page,
  match: (request: Request) => boolean,
) {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*", async (route) => {
    if (match(route.request())) await released;
    await route.fallback();
  });
  return release;
}

/**
 * 让之后匹配的请求失败，像服务端处理时遇到了意外错误，返回函数恢复正常。Server Action 按 Next 的约定回
 * `text/plain` 的 500，调用方拿到一个被拒绝的 promise；Route Handler 回 `lib/request/fetch.ts` 认得的失败响应体。
 * `delayMs` 让失败晚一些返回。要看请求返回之前的乐观更新，改用 `holdRequests` 停住请求、由测试放行，不和时间赛跑。
 * `status` 只用于 Route Handler：换成 4xx 时 query 不重试，失败立即可见；默认的 500 会先重试几次
 * （lib/request/fetch.ts 的 `shouldRetryRequest`）。Server Action 总是回 500，mutation 不重试。
 */
export async function failRequests(
  page: Page,
  match: (request: Request) => boolean,
  { delayMs = 0, status = 500 } = {},
) {
  const handler = async (route: Route) => {
    const request = route.request();
    if (!match(request)) return route.fallback();
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    if (isServerAction(request)) {
      return route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "Injected failure",
      });
    }
    return route.fulfill({
      status,
      json: { error: { code: status * 100, message: "Injected failure" } },
    });
  };
  await page.route("**/*", handler);
  return () => page.unroute("**/*", handler);
}

/**
 * 在同一个 context 里另开一个页面打开 `url`，拦住应用的 JS 包：React 不运行，页面停在服务端返回的 HTML 上，
 * Suspense 的片段照常由 HTML 里的内联脚本换上。浏览器里的刷新（轮询、变化信号）都不运行，看到的就是服务端渲染的
 * 结果。用完调用方关闭它。
 */
export async function openWithoutScripts(page: Page, url: string) {
  const htmlPage = await page.context().newPage();
  await htmlPage.route("**/_next/static/**", (route) =>
    route.request().resourceType() === "script"
      ? route.abort()
      : route.continue(),
  );
  await htmlPage.goto(url);
  return htmlPage;
}

/**
 * 点击一个应该在浏览器里完成导航的链接，等地址变成 `url`，并断言没有发出整页请求。服务端渲染的链接在 hydration
 * 之前被点到会整页加载，之后的步骤就不再是在客户端渲染的页面上做的：调用方先等页面上一个只在浏览器里出现的信号，
 * 这里再确认点击确实被 React 接住了，点早了就直接失败，不会悄悄换成整页加载。
 */
export async function clickForClientNavigation(
  page: Page,
  link: Locator,
  url: string,
) {
  const documents: string[] = [];
  const record = (request: Request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  };
  page.on("request", record);
  try {
    await link.click();
    await expect(page).toHaveURL(url);
  } finally {
    page.off("request", record);
  }
  expect(documents, "链接应当在浏览器里导航，不发整页请求").toStrictEqual([]);
}

/**
 * 断言控件是原生停用的：带 `disabled` 属性。`toBeDisabled` 对 `aria-disabled` 也算通过，而只有 `aria-disabled` 的
 * 控件照样响应原生操作，比如 hydration 之前的提交按钮仍能原生提交表单。
 */
export async function expectNativelyDisabled(locator: Locator) {
  await expect(locator).toHaveAttribute("disabled");
}

/**
 * 断言元素的文字和它实际显示在上面的背景之间的对比度不低于 `minimum`，按 WCAG 2 的算法，默认是正文的 4.5:1。半透明的
 * 背景色（比如 `bg-primary/10`）从元素自己开始往上逐层叠到第一个不透明的背景色上，和浏览器绘制时一样在 sRGB 里叠加。
 * 只看各层的 background-color：背景图、渐变、opacity 和不是祖先的元素叠在下面（比如定位）都不算，用在背景只由自己和
 * 祖先的背景色决定的元素上。
 */
export async function expectTextContrast(locator: Locator, minimum = 4.5) {
  const ratio = await locator.evaluate((element) => {
    /** 0–1 的 sRGB 分量（已按传递函数编码）和不透明度。 */
    interface Color {
      red: number;
      green: number;
      blue: number;
      alpha: number;
    }
    const number = String.raw`(-?[\d.]+(?:e-?\d+)?)`;
    const rgbPattern = new RegExp(
      String.raw`^rgba?\(${number}, ${number}, ${number}(?:, ${number})?\)$`,
    );
    const oklabPattern = new RegExp(
      String.raw`^oklab\(${number} ${number} ${number}(?: / ${number})?\)$`,
    );

    function encodeSrgb(linear: number) {
      const clamped = Math.min(1, Math.max(0, linear));
      return clamped <= 0.0031308
        ? 12.92 * clamped
        : 1.055 * clamped ** (1 / 2.4) - 0.055;
    }

    // https://bottosson.github.io/posts/oklab/ 的矩阵：OKLab 转成线性 sRGB，再按 sRGB 的传递函数编码。
    function oklabToSrgb(l: number, a: number, b: number, alpha: number) {
      const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
      const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
      const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
      return {
        red: encodeSrgb(
          4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
        ),
        green: encodeSrgb(
          -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
        ),
        blue: encodeSrgb(
          -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
        ),
        alpha,
      };
    }

    // Chrome 把 hex、rgb() 算出的颜色写成 rgb()/rgba()，把 Tailwind 的 `/10` 这类 color-mix(in oklab, …) 写成 oklab()。
    // 别的格式没有换算，直接报错，免得读错颜色却照样通过。
    function parseColor(color: string): Color {
      const rgb = rgbPattern.exec(color);
      if (rgb) {
        return {
          red: Number(rgb[1]) / 255,
          green: Number(rgb[2]) / 255,
          blue: Number(rgb[3]) / 255,
          alpha: rgb[4] === undefined ? 1 : Number(rgb[4]),
        };
      }
      const oklab = oklabPattern.exec(color);
      if (oklab) {
        return oklabToSrgb(
          Number(oklab[1]),
          Number(oklab[2]),
          Number(oklab[3]),
          oklab[4] === undefined ? 1 : Number(oklab[4]),
        );
      }
      throw new Error(`expectTextContrast 不认识这个颜色格式：${color}`);
    }

    function over(top: Color, bottom: Color): Color {
      const mix = (upper: number, lower: number) =>
        upper * top.alpha + lower * (1 - top.alpha);
      return {
        red: mix(top.red, bottom.red),
        green: mix(top.green, bottom.green),
        blue: mix(top.blue, bottom.blue),
        alpha: 1,
      };
    }

    // https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
    function luminance({ red, green, blue }: Color) {
      const linear = (channel: number) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      return (
        0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
      );
    }

    const translucent: Color[] = [];
    let background: Color | undefined;
    for (
      let node: Element | null = element;
      node !== null && background === undefined;
      node = node.parentElement
    ) {
      const layer = parseColor(getComputedStyle(node).backgroundColor);
      if (layer.alpha >= 1) background = layer;
      else translucent.push(layer);
    }
    if (background === undefined) {
      throw new Error(
        "expectTextContrast 在元素和它的祖先上都没找到不透明的背景色",
      );
    }
    for (const layer of translucent.reverse()) {
      background = over(layer, background);
    }
    const text = over(parseColor(getComputedStyle(element).color), background);
    const [lighter, darker] = [luminance(text), luminance(background)].sort(
      (x, y) => y - x,
    );
    return (lighter + 0.05) / (darker + 0.05);
  });
  expect(ratio, "文字和背景的对比度").toBeGreaterThanOrEqual(minimum);
}
