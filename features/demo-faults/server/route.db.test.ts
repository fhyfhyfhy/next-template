import { describe, expect, test, vi } from "vitest";

import { demoRoute } from "./route";

const handler = demoRoute(async () => ({ ok: true }));

describe("Demo backend 没有启用时", () => {
  test("Route Handler 一律返回 404", async () => {
    vi.stubEnv("DEMO_DATABASE_URL", ""); // lib/env.ts 把空字符串当作没设置
    try {
      const response = await handler(
        new Request("http://localhost/api/demo/tasks/task-01"),
        {},
      );
      expect(response.status).toBe(404);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
