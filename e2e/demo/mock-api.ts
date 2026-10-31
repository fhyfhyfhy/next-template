import {
  type APIRequestContext,
  expect,
  type Page,
  test as base,
} from "@playwright/test";

// e2e 只通过浏览器和 Mock API 的控制接口观察、准备条件，不引用应用代码。
// 端口由 playwright.demo.config.ts 设置。没有它就报错，不回落到 demo:* 命令默认的端口：那是开着的 demo:dev 在用的 Mock API。
const mockApiPort = process.env.MOCK_API_PORT;
if (!mockApiPort) {
  throw new Error(
    "MOCK_API_PORT is not set; run these specs with playwright.demo.config.ts",
  );
}
export const MOCK_API_URL = `http://127.0.0.1:${mockApiPort}`;

export interface MockFault {
  method: string;
  path: string;
  latency_ms?: number;
  status?: number;
  code?: number;
  malformed?: boolean;
  times?: number;
}

export class MockApi {
  private readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  /** 恢复种子数据和默认延迟、清除故障，并暂停自动推进：任务状态只在测试调用 `advance` 时变化。 */
  async reset() {
    await this.control("POST", "/__mock/reset", { paused: true });
  }

  async setFaults(faults: MockFault[]) {
    await this.control("PUT", "/__mock/faults", { faults });
  }

  /** 把任务推进 `steps` 步：pending → running 0% → 每步 +25% → 终态。 */
  async advance(taskId: string, steps = 1) {
    for (let step = 0; step < steps; step += 1) {
      await this.control("POST", `/__mock/tasks/${taskId}/advance`);
    }
  }

  /** 重置以来 Mock API 收到的业务请求，`path` 是匹配的路由模式，比如 `/demo/tasks/:id`。 */
  async requests(path?: string): Promise<{ method: string; url: string }[]> {
    const { requests } = await this.control("GET", "/__mock/requests");
    return requests.filter(
      (request: { path: string }) =>
        path === undefined || request.path === path,
    );
  }

  /** 业务接口当前的默认延迟（毫秒）。 */
  async latency(): Promise<number> {
    return (await this.control("GET", "/__mock/latency")).latency_ms;
  }

  /** 直接调用业务接口准备数据，绕过页面。 */
  async call(method: string, path: string, data?: unknown) {
    return this.control(method, path, data);
  }

  private async control(method: string, path: string, data?: unknown) {
    const response = await this.request.fetch(`${MOCK_API_URL}${path}`, {
      method,
      data,
    });
    expect(response.ok(), `${method} ${path}`).toBe(true);
    // 204 没有响应体。
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
}

/** 每个测试开始前重置 Mock API，不管测试有没有用到它。 */
export const test = base.extend<{ mockApi: MockApi }>({
  mockApi: [
    async ({ request }, use) => {
      const mockApi = new MockApi(request);
      await mockApi.reset();
      await use(mockApi);
    },
    { auto: true },
  ],
});

/**
 * 从当前的 Data demo 页面经导航栏客户端导航到 `url`。整页加载后，服务端渲染的控件要等 hydrate 才响应点击；
 * 客户端导航在浏览器里渲染整页，没有要等 hydrate 的部分，到达后就能操作。导航栏的进行中徽标只在浏览器里请求，
 * 它和导航链接在同一个 Suspense 边界里，徽标出现说明链接已经 hydrate，点击是客户端导航。
 */
export async function navigateThroughHeader(
  page: Page,
  link: string,
  url: string,
) {
  await expect(page.getByLabel(/^进行中的任务 \d+ 个$/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Data demo 导航" })
    .getByRole("link", { name: link })
    .click();
  await expect(page).toHaveURL(url);
}

/**
 * 通过故障实验室的“重置”按钮重置：除了 Mock API，还让 Next 服务端的任务列表缓存失效。
 * 读服务端缓存的页面（全部任务、作品广场）在测试开始时用它，免得读到上一个测试留下的缓存。
 * 按钮在静态 shell 里，整页打开故障实验室后立即点击可能早于 hydration，所以经导航栏进入。
 */
export async function resetThroughLab(page: Page) {
  await page.goto("/demos/search");
  await navigateThroughHeader(page, "故障实验室", "/demos/lab");
  await page.getByRole("button", { name: "重置 Mock 数据" }).click();
  await expect(page.getByText("已重置")).toBeVisible();
}

export { expect };
