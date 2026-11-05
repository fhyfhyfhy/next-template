import { describe, expect, test, vi } from "vitest";

import { getTaskOverHttp, resetDemoBeforeEach } from "./db-test-helpers";

resetDemoBeforeEach();

describe("Demo 后端没有启用时", () => {
  test("Route Handler 一律返回 404", async () => {
    vi.stubEnv("DEMO_DATABASE_URL", ""); // lib/env.ts 把空字符串当作没设置
    try {
      const response = await getTaskOverHttp(
        new Request("http://localhost/api/demo/tasks/task-01"),
        {},
      );
      expect(response.status).toBe(404);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
