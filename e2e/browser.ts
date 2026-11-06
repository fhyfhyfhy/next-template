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

/** 等下一个 Server Action 的响应。Server Action 返回时，服务端已经写入。 */
export function waitForServerAction(page: Page) {
  return page.waitForResponse((response) => isServerAction(response.request()));
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
 * `text/plain` 的 500，调用方拿到一个被拒绝的 promise；Route Handler 回 `lib/fetch.ts` 认得的失败响应体。
 * `delayMs` 让失败晚一些返回：用例能看到请求返回之前的乐观更新，失败后又不留下写入。
 * `status` 只用于 Route Handler：换成 4xx 时 query 不重试，失败立即可见；默认的 500 会先重试几次
 * （lib/fetch.ts 的 `shouldRetryRequest`）。Server Action 总是回 500，mutation 不重试。
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
