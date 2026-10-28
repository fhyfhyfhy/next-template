import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { z } from "zod";

import {
  ApiError,
  fetchApi,
  SchemaValidationError,
  shouldRetryRequest,
} from "./fetch.ts";

const routes = {
  "/echo": (request, body, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        method: request.method,
        url: request.url,
        contentType: request.headers["content-type"] ?? null,
        body,
      }),
    );
  },
  "/empty": (_request, _body, response) => {
    response.statusCode = 204;
    response.end();
  },
  "/not-found": (_request, _body, response) => {
    response.statusCode = 404;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ message: "missing" }));
  },
  "/bad-gateway": (_request, _body, response) => {
    response.statusCode = 502;
    response.end("<html>Bad Gateway</html>");
  },
  "/slow": (_request, _body, response) => {
    setTimeout(() => response.end("null"), 500);
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

test.before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.NEXT_PUBLIC_API_BASE_URL = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(() => {
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
  assert.equal(result.method, "GET");
  assert.equal(result.url, "/api/echo?ids=a,b&q=%E4%B8%AD%20%E6%96%87");
});

test("普通对象作为 JSON 发送，FormData 原样发送并保留自动生成的 multipart header", async () => {
  const json = await fetchApi({
    url: "/echo",
    method: "POST",
    data: { title: "x" },
    schema: echoSchema,
  });
  assert.equal(json.contentType, "application/json");
  assert.equal(json.body, '{"title":"x"}');

  const form = new FormData();
  form.set("file", "content");
  const multipart = await fetchApi({
    url: "/echo",
    method: "POST",
    data: form,
    schema: echoSchema,
  });
  assert.match(multipart.contentType, /^multipart\/form-data; boundary=/);
});

test("返回 schema 的输出，空响应体按 null 校验", async () => {
  const result = await fetchApi({
    url: "/echo",
    schema: echoSchema.transform(({ method }) => ({ verb: method })),
  });
  assert.deepEqual(result, { verb: "GET" });
  assert.equal(await fetchApi({ url: "/empty", schema: z.null() }), null);
});

test("2xx 响应不符合 schema 时抛 SchemaValidationError，错误信息包含路径和字段", async () => {
  await assert.rejects(
    fetchApi({ url: "/echo", schema: z.object({ method: z.number() }) }),
    (error) =>
      error instanceof SchemaValidationError &&
      error.url === "/echo" &&
      error.issues[0].path[0] === "method" &&
      error.message.includes("method"),
  );
});

test("非 2xx 抛 ApiError，body 是 JSON 解析结果，不是 JSON 时保留文本", async () => {
  await assert.rejects(
    fetchApi({ url: "/not-found", schema: z.unknown() }),
    (error) =>
      error instanceof ApiError &&
      error.status === 404 &&
      error.body.message === "missing",
  );
  await assert.rejects(
    fetchApi({ url: "/bad-gateway", schema: z.unknown() }),
    (error) =>
      error instanceof ApiError &&
      error.status === 502 &&
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
  await assert.rejects(pending, (error) => error.name === "AbortError");
});

test("4xx 和 schema 不匹配不重试，5xx 和网络错误最多重试 3 次", () => {
  const schemaError = new SchemaValidationError(
    "/x",
    z.string().safeParse(1).error,
  );
  assert.equal(shouldRetryRequest(0, schemaError), false);
  assert.equal(
    shouldRetryRequest(0, new ApiError({ url: "/x", status: 404, body: null })),
    false,
  );
  for (const error of [
    new ApiError({ url: "/x", status: 502, body: null }),
    new TypeError("fetch failed"),
  ]) {
    assert.equal(shouldRetryRequest(2, error), true);
    assert.equal(shouldRetryRequest(3, error), false);
  }
});
