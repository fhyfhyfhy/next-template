import { expect, test } from "./test";

// 生产 build 不提供 Demo（lib/demos.ts）：不管带不带 locale 前缀，proxy.ts 都返回 404。
const DEMO_PAGES = [
  "/demos",
  "/demos/ui",
  "/demos/tasks",
  "/demos/tasks/task-01",
  "/en/demos",
  "/zh/demos/feed",
];

test("生产 build 对每个 Demo 页面都返回 404", async ({ request }) => {
  for (const path of DEMO_PAGES) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
    expect(await response.text(), path).toBe("Not found\n");
  }
});

// 普通命令不设 DEMO_* 变量，Demo 后端没有启用（features/demo-task/server/connection.ts）。
test("生产 build 的 /api/demo 下的接口都返回 404", async ({ request }) => {
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
