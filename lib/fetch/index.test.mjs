import { createServer } from "node:http";
import { afterAll, beforeAll, expect, test } from "vitest";
import { z } from "zod";

import {
  ApiError,
  fetchApi,
  SchemaValidationError,
  shouldRetryRequest,
} from "./index.ts";

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

// The base URL has an /api prefix, to confirm that the path goes after the base URL.
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

test("the path goes after the base URL, and params drops undefined and serializes arrays by paramsSerializer", async () => {
  const result = await fetchApi({
    url: "/echo",
    params: { ids: ["a", "b"], status: undefined, q: "中 文" },
    paramsSerializer: { arrayFormat: "comma" },
    schema: echoSchema,
  });
  expect(result.method).toBe("GET");
  expect(result.url).toBe("/api/echo?ids=a,b&q=%E4%B8%AD%20%E6%96%87");
});

test("a plain object is sent as JSON, and FormData as it is, keeping the generated multipart header", async () => {
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

test("returns the schema's output for the body, and validates an empty body as null", async () => {
  const result = await fetchApi({
    url: "/echo",
    schema: echoSchema.transform(({ method }) => ({ verb: method })),
  });
  expect(result).toStrictEqual({ verb: "GET" });
  expect(await fetchApi({ url: "/empty", schema: z.null() })).toBe(null);
});

test("throws SchemaValidationError when the body does not match the schema, with the path and field in the message", async () => {
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

test("a non-2xx throws ApiError, with code, param, params and message from the body's error object", async () => {
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

test("a 2xx whose body is only an error object throws ApiError, and a resource's own error field is returned", async () => {
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

test("a non-2xx whose body is not an error object has no code, and body keeps the parsed JSON or the raw text", async () => {
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

test("the caller's abort is thrown as it is", async () => {
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

test("a 4xx, an error on a 2xx and a schema mismatch are not retried, a 5xx and a network error up to 3 times", () => {
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
