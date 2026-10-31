import { expect, test } from "./test";

// 用普通命令 build 和 start 时没有 Mock API，Data demo 只能显示说明。服务端的请求没有后端地址可发，
// 一发就让 build 或页面报错；浏览器发出的业务请求由下面的监听记下。
const DATA_DEMO_PAGES = [
  "/demos/tasks",
  "/demos/tasks/task-01",
  "/demos/feed",
  "/demos/search",
  "/demos/recent",
  "/demos/lab",
];

test("没有 Mock API 时，Data demo 页面只显示说明，不请求业务接口", async ({
  page,
}) => {
  const businessRequests: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/demo/") || pathname.startsWith("/__mock/")) {
      businessRequests.push(request.url());
    }
  });

  for (const path of DATA_DEMO_PAGES) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Mock API 未运行" }),
    ).toBeVisible();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- 断言页面 hydrate 之后的一段时间里也不发业务请求，等待是断言的一部分。
    await page.waitForTimeout(300);
  }

  expect(businessRequests).toStrictEqual([]);
});
