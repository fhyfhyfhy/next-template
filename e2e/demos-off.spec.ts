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
