import { createServer } from "node:http";
import { afterAll, beforeAll, expect, test } from "vitest";
import { z } from "zod";

import {
  ApiError,
  fetchApi,
  SchemaValidationError,
  shouldRetryRequest,
} from "./fetch.ts";

function sendJson(response, status, value) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(value));
}

const routes = {
  "/echo": (request, body, response) => {
    sendJson(response, 200, {
      method: request.method,
      url: request.url,
      contentType: request.headers["content-type"] ?? null,
      body,
    });
  },
  "/empty": (_request, _body, response) => {
    response.statusCode = 204;
    response.end();
  },
  "/ok-error": (_request, _body, response) => {
    sendJson(response, 200, {
      error: { code: 40902, message: "Status changed" },
    });
  },
  "/failed-task": (_request, _body, response) => {
    sendJson(response, 200, {
      id: "task_1",
      error: { code: 1, message: "材质计算出错" },
    });
  },
  "/name-taken": (_request, _body, response) => {
    sendJson(response, 409, {
      error: {
        code: 40901,
        message: "Name already exists",
        param: "name",
        params: { max: 40 },
      },
    });
  },
  "/not-found": (_request, _body, response) => {
    sendJson(response, 404, { detail: "missing" });
  },
  "/bad-gateway": (_request, _body, response) => {
    response.statusCode = 502;
    response.end("<html>Bad Gateway</html>");
  },
  "/slow": (_request, _body, response) => {
    setTimeout(() => sendJson(response, 200, null), 500);
  },
};

// base URL 带 /api 前缀，用来确认路径拼在 base URL 之后。
const server = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const { pathname } = new URL(request.url, "http://localhost");
    routes[pathname.replace(/^\/api/, "")](request, body, response);
  });
});

const echoSchema = z.object({
  method: z.string(),
  url: z.string(),
  contentType: z.string().nullable(),
  body: z.string(),
});

beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.NEXT_PUBLIC_API_BASE_URL = `http://127.0.0.1:${server.address().port}/api`;
});

afterAll(() => {
  server.close();
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
});

test("路径拼在 base URL 之后，params 丢弃 undefined 并按 paramsSerializer 序列化数组", async () => {
  const result = await fetchApi({
    url: "/echo",
    params: { ids: ["a", "b"], status: undefined, q: "中 文" },
    paramsSerializer: { arrayFormat: "comma" },
    schema: echoSchema,
  });
  expect(result.method).toBe("GET");
  expect(result.url).toBe("/api/echo?ids=a,b&q=%E4%B8%AD%20%E6%96%87");
});

test("普通对象作为 JSON 发送，FormData 原样发送并保留自动生成的 multipart header", async () => {
  const json = await fetchApi({
    url: "/echo",
    method: "POST",
    data: { title: "x" },
    schema: echoSchema,
  });
  expect(json.contentType).toBe("application/json");
  expect(json.body).toBe('{"title":"x"}');

  const form = new FormData();
  form.set("file", "content");
  const multipart = await fetchApi({
    url: "/echo",
    method: "POST",
    data: form,
    schema: echoSchema,
  });
  expect(multipart.contentType).toMatch(/^multipart\/form-data; boundary=/);
});

test("返回响应体经 schema 的输出，空响应体按 null 校验", async () => {
  const result = await fetchApi({
    url: "/echo",
    schema: echoSchema.transform(({ method }) => ({ verb: method })),
  });
  expect(result).toStrictEqual({ verb: "GET" });
  expect(await fetchApi({ url: "/empty", schema: z.null() })).toBe(null);
});

test("响应体不符合 schema 时抛 SchemaValidationError，错误信息包含路径和字段", async () => {
  await expect(
    fetchApi({ url: "/echo", schema: z.object({ method: z.number() }) }),
  ).rejects.toSatisfy(
    (error) =>
      error instanceof SchemaValidationError &&
      error.url === "/echo" &&
      error.issues[0].path[0] === "method" &&
      error.message.includes("method"),
  );
});

test("非 2xx 抛 ApiError，code、param、params 和 message 取自响应体的 error 对象", async () => {
  await expect(
    fetchApi({ url: "/name-taken", schema: z.null() }),
  ).rejects.toSatisfy(
    (error) =>
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === 40901 &&
      error.param === "name" &&
      error.params.max === 40 &&
      error.message ===
        "/name-taken responded with 409, code 40901: Name already exists",
  );
});

test("2xx 的响应体只有 error 对象时抛 ApiError，资源自带的 error 字段照常返回", async () => {
  await expect(
    fetchApi({ url: "/ok-error", schema: z.unknown() }),
  ).rejects.toSatisfy(
    (error) =>
      error instanceof ApiError &&
      error.status === 200 &&
      error.code === 40902 &&
      error.message ===
        "/ok-error responded with 200, code 40902: Status changed",
  );
  const task = await fetchApi({
    url: "/failed-task",
    schema: z.object({
      id: z.string(),
      error: z.object({ message: z.string() }),
    }),
  });
  expect(task.error.message).toBe("材质计算出错");
});

test("非 2xx 的响应体不是 error 对象时没有 code，body 保留 JSON 解析结果或原始文本", async () => {
  await expect(
    fetchApi({ url: "/not-found", schema: z.unknown() }),
  ).rejects.toSatisfy(
    (error) =>
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === undefined &&
      error.body.detail === "missing" &&
      error.message === "/not-found responded with 404",
  );
  await expect(
    fetchApi({ url: "/bad-gateway", schema: z.unknown() }),
  ).rejects.toSatisfy(
    (error) =>
      error instanceof ApiError &&
      error.status === 502 &&
      error.code === undefined &&
      error.body === "<html>Bad Gateway</html>",
  );
});

test("调用方主动中止原样抛出", async () => {
  const controller = new AbortController();
  const pending = fetchApi({
    url: "/slow",
    schema: z.null(),
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).rejects.toSatisfy(
    (error) => error.name === "AbortError",
  );
});

test("4xx、2xx 上的 error 和 schema 不匹配不重试，5xx 和网络错误最多重试 3 次", () => {
  const schemaError = new SchemaValidationError(
    "/x",
    z.string().safeParse(1).error,
  );
  expect(shouldRetryRequest(0, schemaError)).toBe(false);
  for (const error of [
    new ApiError({ url: "/x", status: 404, body: null }),
    new ApiError({
      url: "/x",
      status: 200,
      body: { error: { code: 40902, message: "Status changed" } },
    }),
  ]) {
    expect(shouldRetryRequest(0, error)).toBe(false);
  }
  for (const error of [
    new ApiError({ url: "/x", status: 502, body: null }),
    new TypeError("fetch failed"),
  ]) {
    expect(shouldRetryRequest(2, error)).toBe(true);
    expect(shouldRetryRequest(3, error)).toBe(false);
  }
});
