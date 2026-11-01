import { expect, test } from "./test";

// 用普通命令 build 和 start 时没有启用 Demo 后端，Data demo 只能显示说明。服务端不读写 Demo 的数据，
// 浏览器发出的 Demo 请求由下面的监听记下；/api/demo 下的接口一律 404。
const DATA_DEMO_PAGES = [
  "/demos/tasks",
  "/demos/tasks/task-01",
  "/demos/feed",
  "/demos/search",
  "/demos/recent",
  "/demos/lab",
];

test("Demo 后端没有启用时，Data demo 页面只显示说明，不请求 Demo 的接口", async ({
  page,
}) => {
  const demoRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/demo/")) {
      demoRequests.push(request.url());
    }
  });

  for (const path of DATA_DEMO_PAGES) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Demo 后端未启用" }),
    ).toBeVisible();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- 断言页面 hydrate 之后的一段时间里也不发 Demo 请求，等待是断言的一部分。
    await page.waitForTimeout(300);
  }

  expect(demoRequests).toStrictEqual([]);
});

test("Demo 后端没有启用时，/api/demo 下的接口返回 404", async ({ request }) => {
  for (const path of [
    "/api/demo/tasks",
    "/api/demo/tasks/task-01",
    "/api/demo/control/faults",
  ]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  expect(
    (await request.post("/api/demo/control/reset", { data: {} })).status(),
  ).toBe(404);
});
