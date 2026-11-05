import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test as base } from "../test";

// e2e 只通过浏览器和 Demo backend 的控制接口（/api/demo/control/*）观察、准备条件，不引用应用代码。
// 控制接口和页面在同一个服务上，请求按 playwright.demo.config.ts 的 baseURL 发出；那个服务用 e2e 数据集，
// 不会动到开着的 demo:dev 的数据。

/** 故障配置，字段含义见 features/demo-task/types/demo-fault.ts；没写的字段按"不生效"补齐。 */
export interface DemoFaultInput {
  /** 数据层操作名，比如 `task.get`、`comment.create`。 */
  operation: string;
  kind:
    | "latency"
    | "unexpected"
    | "businessError"
    | "httpStatus"
    | "errorOnSuccess"
    | "malformed";
  latencyMs?: number;
  status?: number;
  code?: number;
  times?: number;
}

export class DemoBackend {
  private readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  /** 恢复种子数据和默认延迟、清除故障和调用记录，并暂停自动推进：任务状态只在测试调用 `advance` 时变化。 */
  async reset() {
    await this.control("POST", "/api/demo/control/reset", { paused: true });
  }

  async setFaults(faults: DemoFaultInput[]) {
    await this.control("PUT", "/api/demo/control/faults", {
      faults: faults.map((fault) => ({
        latencyMs: 0,
        status: null,
        code: null,
        times: null,
        ...fault,
      })),
    });
  }

  /** 把任务推进 `steps` 步：pending → running 0% → 每步 +25% → 终态。 */
  async advance(taskId: string, steps = 1) {
    for (let step = 0; step < steps; step += 1) {
      await this.control("POST", `/api/demo/control/tasks/${taskId}/advance`);
    }
  }

  /**
   * 重置以来数据层的调用记录。`source` 为 `server` 时是服务端直接调用（渲染、Server Action），
   * `http` 时是浏览器经 Route Handler 调用。
   */
  async calls(
    operation: string,
    source?: "server" | "http",
  ): Promise<{ operation: string; source: string }[]> {
    const { calls } = await this.control(
      "GET",
      `/api/demo/control/calls?operation=${encodeURIComponent(operation)}`,
    );
    return calls.filter(
      (call: { source: string }) =>
        source === undefined || call.source === source,
    );
  }

  /** 业务操作当前的默认延迟（毫秒）。 */
  async latency(): Promise<number> {
    return (await this.control("GET", "/api/demo/control/latency")).latencyMs;
  }

  // 下面三个模拟别的客户端改了数据：和页面上的写入走同一个数据层函数，但不让 Next 的缓存失效。

  async renameTask(taskId: string, name: string) {
    await this.control("POST", `/api/demo/control/tasks/${taskId}/rename`, {
      name,
    });
  }

  async deleteTask(taskId: string) {
    await this.control("DELETE", `/api/demo/control/tasks/${taskId}`);
  }

  async retryTask(taskId: string) {
    await this.control("POST", `/api/demo/control/tasks/${taskId}/retry`);
  }

  private async control(method: string, path: string, data?: unknown) {
    const response = await this.request.fetch(path, { method, data });
    expect(response.ok(), `${method} ${path}`).toBe(true);
    // 204 没有响应体。
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
}

/** 每个测试开始前重置 Demo backend，不管测试有没有用到它。 */
export const test = base.extend<{ demoBackend: DemoBackend }>({
  demoBackend: [
    async ({ request }, use) => {
      const demoBackend = new DemoBackend(request);
      await demoBackend.reset();
      await use(demoBackend);
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
 * 通过故障实验室的“重置”按钮重置：它的 Server Action 除了恢复数据，还让 Next 服务端的任务列表缓存失效。
 * 读服务端缓存的页面（全部任务、作品广场）在测试开始时用它，免得读到上一个测试留下的缓存。
 * 按钮在静态 shell 里，整页打开故障实验室后立即点击可能早于 hydration，所以经导航栏进入。
 */
export async function resetThroughLab(page: Page) {
  await page.goto("/demos/search");
  await navigateThroughHeader(page, "故障实验室", "/demos/lab");
  await page.getByRole("button", { name: "重置 Demo 数据" }).click();
  await expect(page.getByText("已重置")).toBeVisible();
}

export { expect };
