import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";

import { ApiError, fetchApi } from "./fetch.ts";

// 部署在某个路径下的项目在 lib/base-path.ts 里设置它。
vi.mock("./base-path.ts", () => ({ BASE_PATH: "/base" }));

function stubFetch(status) {
  const requested = [];
  vi.stubGlobal("fetch", async (input) => {
    requested.push(String(input));
    return new Response("null", { status });
  });
  return requested;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("设置了 basePath 时，同源路径带上它请求，其他服务的完整 URL 不变", async () => {
  const requested = stubFetch(200);
  await fetchApi({ url: "/api/tasks", params: { page: 2 }, schema: z.null() });
  await fetchApi({ url: "https://api.example.com/v1/items", schema: z.null() });
  expect(requested).toStrictEqual([
    "/base/api/tasks?page=2",
    "https://api.example.com/v1/items",
  ]);
});

test("请求失败时，错误里的路径是调用方写的路径", async () => {
  stubFetch(404);
  const error = await fetchApi({ url: "/api/tasks", schema: z.null() }).catch(
    (caught) => caught,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect(error.url).toBe("/api/tasks");
});
