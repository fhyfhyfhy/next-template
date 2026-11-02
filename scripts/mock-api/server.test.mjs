import { createServer as createHttpServer } from "node:http";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

import { findRunningMockApi, startMockApi } from "./server.mjs";

let mockApi;

beforeAll(async () => {
  mockApi = await startMockApi({ port: 0, latencyMs: 0 });
});

afterAll(() => mockApi.close());

beforeEach(() => control("POST", "/__mock/reset", { paused: true }));

async function request(method, path, body) {
  const response = await fetch(`${mockApi.url}${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function control(method, path, body) {
  const { status, body: result } = await request(method, path, body);
  expect(status, JSON.stringify(result)).toBeLessThan(300);
  return result;
}

test("the task list returns the seed data paginated, newest first", async () => {
  const { status, body } = await request("GET", "/demo/tasks?page_size=5");

  expect(status).toBe(200);
  expect(body.page).toBe(1);
  expect(body.pageSize).toBe(5);
  expect(body.items.length).toBe(5);
  expect(body.hasMore).toBe(true);
  const createdAt = body.items.map((task) => task.created_at);
  expect(createdAt).toStrictEqual([...createdAt].sort((a, b) => b - a));
  expect(Object.keys(body.items[0]).sort()).toStrictEqual([
    "cover_url",
    "created_at",
    "favorite",
    "id",
    "name",
    "progress",
    "prompt",
    "status",
    "updated_at",
  ]);
});

test("the task list filters by status, favorite and prompt, and status can repeat", async () => {
  const active = await control(
    "GET",
    "/demo/tasks?status=pending&status=running&page_size=50",
  );
  expect(active.items.map((task) => task.status).sort()).toStrictEqual([
    "pending",
    "pending",
    "running",
    "running",
  ]);

  const favorites = await control("GET", "/demo/tasks?favorite=true");
  expect(favorites.items.length).toBeGreaterThan(0);
  expect(favorites.items.filter((task) => !task.favorite)).toStrictEqual([]);

  const fox = await control("GET", "/demo/tasks/task-01");
  const related = await control(
    "GET",
    `/demo/tasks?prompt=${encodeURIComponent(fox.prompt)}&exclude_id=task-01`,
  );
  expect(related.items.map((task) => task.name).sort()).toStrictEqual([
    "坐着的狐狸 v2",
    "橙色狐狸草稿",
  ]);
});

test("sorts by name", async () => {
  const page = await control("GET", "/demo/tasks?sort=name_asc&page_size=50");
  const names = page.items.map((task) => task.name);
  expect(names).toStrictEqual(
    [...names].sort((a, b) => a.localeCompare(b, "zh-CN")),
  );
});

test("a created task starts pending, at the top of the list", async () => {
  const created = await control("POST", "/demo/tasks", {
    name: "  新的狐狸  ",
    prompt: "一只狐狸",
  });
  expect(created.name).toBe("新的狐狸");
  expect(created.status).toBe("pending");
  expect(created.progress).toBe(0);
  expect(created.favorite).toBe(false);

  const page = await control("GET", "/demo/tasks?page_size=1");
  expect(page.items[0].id).toBe(created.id);
});

test("a taken name refuses create and rename with 409 and a business code, with param pointing at name", async () => {
  const created = await request("POST", "/demo/tasks", {
    name: "低多边形狐狸",
    prompt: "一只狐狸",
  });
  expect(created.status).toBe(409);
  expect(created.body.error).toStrictEqual({
    code: 40901,
    message: expect.any(String),
    param: "name",
  });

  const renamed = await request("PATCH", "/demo/tasks/task-02", {
    name: "低多边形狐狸",
  });
  expect([renamed.status, renamed.body.error.code]).toStrictEqual([409, 40901]);

  const kept = await control("PATCH", "/demo/tasks/task-01", {
    name: "低多边形狐狸",
  });
  expect(kept.name).toBe("低多边形狐狸");
});

test("an empty name or prompt returns 400, with param and params naming the field and its length limit", async () => {
  const { status, body } = await request("POST", "/demo/tasks", {
    name: " ",
    prompt: "一只狐狸",
  });
  expect(status).toBe(400);
  expect(body.error).toStrictEqual({
    code: 40000,
    message: expect.any(String),
    param: "name",
    params: { max: 40 },
  });
});

async function advance(id, steps = 1) {
  let task;
  for (let step = 0; step < steps; step += 1) {
    task = await control("POST", `/__mock/tasks/${id}/advance`);
  }
  return task;
}

test("the advance endpoint walks a task step by step to done", async () => {
  const { id } = await control("POST", "/demo/tasks", {
    name: "推进测试",
    prompt: "一只狐狸",
  });

  const progress = [];
  for (let step = 0; step < 5; step += 1) {
    const task = await advance(id);
    progress.push([task.status, task.progress]);
  }
  const done = await advance(id);

  expect(progress).toStrictEqual([
    ["running", 0],
    ["running", 25],
    ["running", 50],
    ["running", 75],
    ["running", 100],
  ]);
  expect([done.status, done.progress]).toStrictEqual(["done", 100]);
  expect([
    (await advance(id)).status,
    (await advance(id)).progress,
  ]).toStrictEqual(["done", 100]);
});

test("a task with fail in its name ends up failed", async () => {
  const { id } = await control("POST", "/demo/tasks", {
    name: "fail 推进测试",
    prompt: "一只狐狸",
  });
  const task = await advance(id, 6);
  expect(task.status).toBe("failed");
});

test("tasks advance on their own over time when not paused", async () => {
  const fastApi = await startMockApi({
    port: 0,
    stepIntervalMs: 10,
    latencyMs: 0,
  });
  try {
    const response = await fetch(`${fastApi.url}/demo/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "自动推进", prompt: "一只狐狸" }),
    });
    const created = await response.json();
    let status = created.status;
    for (let attempt = 0; attempt < 50 && status !== "done"; attempt += 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
      const detail = await fetch(`${fastApi.url}/demo/tasks/${created.id}`);
      status = (await detail.json()).status;
    }
    expect(status).toBe("done");
  } finally {
    await fastApi.close();
  }
});

test("tasks do not advance on their own while paused", async () => {
  const fastApi = await startMockApi({
    port: 0,
    stepIntervalMs: 10,
    latencyMs: 0,
  });
  try {
    await fetch(`${fastApi.url}/__mock/clock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: true }),
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 60));
    const response = await fetch(`${fastApi.url}/demo/tasks/task-11`);
    expect((await response.json()).status).toBe("pending");
  } finally {
    await fastApi.close();
  }
});

test("only failed tasks can be retried, which returns them to pending with progress cleared", async () => {
  const retried = await control("POST", "/demo/tasks/task-05/retry");
  expect([retried.status, retried.progress]).toStrictEqual(["pending", 0]);

  const again = await request("POST", "/demo/tasks/task-05/retry");
  expect([again.status, again.body.error.code]).toStrictEqual([409, 40902]);

  const done = await request("POST", "/demo/tasks/task-01/retry");
  expect(done.body.error.code).toBe(40902);
});

test("sets favorite", async () => {
  const favorited = await control("PUT", "/demo/tasks/task-02/favorite", {
    favorite: true,
  });
  expect(favorited.favorite).toBe(true);
  const unfavorited = await control("PUT", "/demo/tasks/task-02/favorite", {
    favorite: false,
  });
  expect(unfavorited.favorite).toBe(false);
});

test("deleting a task deletes its comments", async () => {
  expect(
    (await control("GET", "/demo/tasks/task-01/comments")).items.length,
  ).toBe(2);

  expect(await control("DELETE", "/demo/tasks/task-01")).toBe(null);

  expect((await request("GET", "/demo/tasks/task-01")).status).toBe(404);
  expect((await request("GET", "/demo/tasks/task-01/comments")).status).toBe(
    404,
  );
});

test("comments are listed oldest first, and their content is 1 to 500 characters after trimming", async () => {
  const comment = await control("POST", "/demo/tasks/task-01/comments", {
    content: "  新评论  ",
  });
  expect(comment.content).toBe("新评论");
  expect(Object.keys(comment).sort()).toStrictEqual([
    "content",
    "created_at",
    "id",
    "task_id",
  ]);

  const { items } = await control("GET", "/demo/tasks/task-01/comments");
  expect(items.at(-1).id).toBe(comment.id);
  const createdAt = items.map((item) => item.created_at);
  expect(createdAt).toStrictEqual([...createdAt].sort((a, b) => a - b));

  for (const content of ["   ", "长".repeat(501)]) {
    const rejected = await request("POST", "/demo/tasks/task-01/comments", {
      content,
    });
    expect([
      rejected.status,
      rejected.body.error.code,
      rejected.body.error.param,
    ]).toStrictEqual([400, 40001, "content"]);
  }
  const longest = await control("POST", "/demo/tasks/task-01/comments", {
    content: "长".repeat(500),
  });
  expect(longest.content.length).toBe(500);
});

test("deletes a comment", async () => {
  const { items } = await control("GET", "/demo/tasks/task-01/comments");
  expect(
    await control("DELETE", `/demo/tasks/task-01/comments/${items[0].id}`),
  ).toBe(null);
  const remaining = await control("GET", "/demo/tasks/task-01/comments");
  expect(remaining.items.map((item) => item.id)).toStrictEqual(
    items.slice(1).map((item) => item.id),
  );
  const missing = await request(
    "DELETE",
    `/demo/tasks/task-01/comments/${items[0].id}`,
  );
  expect(missing.status).toBe(404);
});

test("search matches the term against name and prompt, and an empty term returns an empty list", async () => {
  const { items } = await control(
    "GET",
    `/demo/tasks/search?term=${encodeURIComponent("狐狸")}`,
  );
  expect(items.map((task) => task.name).sort()).toStrictEqual([
    "低多边形狐狸",
    "坐着的狐狸 v2",
    "橙色狐狸草稿",
  ]);
  const byPrompt = await control(
    "GET",
    `/demo/tasks/search?term=${encodeURIComponent("能量核心")}`,
  );
  expect(byPrompt.items.length).toBe(3);
  expect(
    (await control("GET", "/demo/tasks/search?term=%20")).items,
  ).toStrictEqual([]);
});

test("the feed holds only done tasks, paginated for infinite scroll", async () => {
  const first = await control("GET", "/demo/feed?page=1&page_size=6");
  const second = await control("GET", "/demo/feed?page=2&page_size=6");
  const last = await control("GET", "/demo/feed?page=3&page_size=6");

  const items = [...first.items, ...second.items, ...last.items];
  expect(items.filter((task) => task.status !== "done")).toStrictEqual([]);
  expect(new Set(items.map((task) => task.id)).size).toBe(items.length);
  expect([first.hasMore, second.hasMore, last.hasMore]).toStrictEqual([
    true,
    true,
    false,
  ]);
});

test("seed cover images can be read, and a task without one returns 404", async () => {
  const withCover = await control("GET", "/demo/tasks/task-01");
  expect(
    withCover.cover_url.startsWith(`${mockApi.url}/demo/tasks/task-01/cover`),
    withCover.cover_url,
  ).toBe(true);
  const cover = await fetch(withCover.cover_url);
  expect(cover.status).toBe(200);
  expect(cover.headers.get("content-type")).toMatch(/^image\//);

  const withoutCover = await control("GET", "/demo/tasks/task-03");
  expect(withoutCover.cover_url).toBe(null);
  expect((await fetch(`${mockApi.url}/demo/tasks/task-03/cover`)).status).toBe(
    404,
  );
});

test("uploading an image replaces the cover and changes the cover URL", async () => {
  const before = await control("GET", "/demo/tasks/task-01");
  const image = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
  const form = new FormData();
  form.append("file", new Blob([image], { type: "image/png" }), "cover.png");

  const response = await fetch(`${mockApi.url}/demo/tasks/task-01/cover`, {
    method: "PUT",
    body: form,
  });
  const updated = await response.json();

  expect(response.status).toBe(200);
  expect(updated.cover_url).not.toBe(before.cover_url);
  const cover = await fetch(updated.cover_url);
  expect(cover.headers.get("content-type")).toBe("image/png");
  expect(new Uint8Array(await cover.arrayBuffer())).toStrictEqual(image);
});

test("uploading something other than an image returns 400", async () => {
  const form = new FormData();
  form.append("file", new Blob(["hello"], { type: "text/plain" }), "a.txt");
  const response = await fetch(`${mockApi.url}/demo/tasks/task-01/cover`, {
    method: "PUT",
    body: form,
  });
  expect(response.status).toBe(400);
});

test("a done task offers a valid .glb model file for download", async () => {
  const response = await fetch(`${mockApi.url}/demo/tasks/task-01/model`);

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("model/gltf-binary");
  expect(response.headers.get("content-disposition")).toMatch(
    new RegExp(
      `filename\\*=UTF-8''${encodeURIComponent("低多边形狐狸")}\\.glb`,
    ),
  );
  const view = new DataView(await response.arrayBuffer());
  expect(view.getUint32(0, true)).toBe(0x46546c67); // "glTF"
  expect(view.getUint32(4, true)).toBe(2);
  expect(view.getUint32(8, true)).toBe(view.byteLength);
  const jsonLength = view.getUint32(12, true);
  expect(view.getUint32(16, true)).toBe(0x4e4f534a); // "JSON"
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(view.buffer, 20, jsonLength)),
  );
  expect(json.asset.version).toBe("2.0");
  expect(json.meshes.length).toBe(1);
  expect(view.getUint32(20 + jsonLength + 4, true)).toBe(0x004e4942); // "BIN"
});

test("downloading the model of an unfinished task returns 409 and a business code", async () => {
  const response = await request("GET", "/demo/tasks/task-03/model");
  expect([response.status, response.body.error.code]).toStrictEqual([
    409, 40903,
  ]);
});

async function* readEvents(response) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = /^event: (.+)$/m.exec(block)?.[1] ?? "message";
      const data = /^data: (.+)$/m.exec(block)?.[1];
      yield { event, data: data ? JSON.parse(data) : null };
    }
  }
}

test("generation logs push existing and new lines over SSE and end at a final status", async () => {
  await advance("task-11", 2);
  const response = await fetch(`${mockApi.url}/demo/tasks/task-11/logs`);
  expect(response.headers.get("content-type")).toBe("text/event-stream");

  const received = [];
  for await (const { event, data } of readEvents(response)) {
    if (event === "end") {
      received.push(["end", data.status]);
      break;
    }
    received.push([event, data.line]);
    if (received.length === 2) await advance("task-11", 4);
  }

  expect(received).toStrictEqual([
    ["log", "开始生成"],
    ["log", "解析 prompt"],
    ["log", "生成网格"],
    ["log", "生成贴图"],
    ["log", "优化拓扑"],
    ["log", "生成完成"],
    ["end", "done"],
  ]);
});

test("a task already in a final status pushes all its logs and ends at once", async () => {
  const response = await fetch(`${mockApi.url}/demo/tasks/task-05/logs`);
  const events = [];
  for await (const event of readEvents(response)) events.push(event.event);
  expect(events.at(-1)).toBe("end");
  expect(events.slice(0, -1).filter((event) => event !== "log")).toStrictEqual(
    [],
  );
});

test("a fault can add latency to an endpoint", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [{ method: "GET", path: "/demo/tasks/:id", latency_ms: 150 }],
  });
  const startedAt = performance.now();
  const { body } = await request("GET", "/demo/tasks/task-01");
  expect(performance.now() - startedAt).toBeGreaterThanOrEqual(140);
  expect(body.id).toBe("task-01");
});

test("business endpoints have a default latency that a fault's latency adds to, and control endpoints have none", async () => {
  const slowApi = await startMockApi({ port: 0, latencyMs: 100 });
  const elapsed = async (path, init) => {
    const startedAt = performance.now();
    await fetch(`${slowApi.url}${path}`, init);
    return performance.now() - startedAt;
  };
  try {
    expect(await elapsed("/demo/tasks/task-01")).toBeGreaterThanOrEqual(95);
    expect(await elapsed("/__mock/faults")).toBeLessThan(95);
    await fetch(`${slowApi.url}/__mock/faults`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        faults: [{ method: "GET", path: "/demo/tasks/:id", latency_ms: 100 }],
      }),
    });
    expect(await elapsed("/demo/tasks/task-01")).toBeGreaterThanOrEqual(195);
  } finally {
    await slowApi.close();
  }
});

test("a request whose client disconnects during the delay is not handled", async () => {
  const slowApi = await startMockApi({ port: 0, latencyMs: 100 });
  try {
    const controller = new AbortController();
    const pending = fetch(`${slowApi.url}/demo/tasks/task-02/favorite`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: true }),
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 20);
    await expect(pending).rejects.toThrow();
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));

    const task = await fetch(`${slowApi.url}/demo/tasks/task-02`);
    expect((await task.json()).favorite).toBe(false);
  } finally {
    await slowApi.close();
  }
});

test("a write caught by a reset during its delay returns 503 without changing the reset data, while reads return as usual", async () => {
  const slowApi = await startMockApi({ port: 0, latencyMs: 100 });
  try {
    const write = fetch(`${slowApi.url}/demo/tasks/task-02/favorite`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: true }),
    });
    const read = fetch(`${slowApi.url}/demo/tasks/task-02`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
    await fetch(`${slowApi.url}/__mock/reset`, { method: "POST" });

    expect((await write).status).toBe(503);
    expect((await read).status).toBe(200);
    const task = await fetch(`${slowApi.url}/demo/tasks/task-02`);
    expect((await task.json()).favorite).toBe(false);
  } finally {
    await slowApi.close();
  }
});

test("an endpoint recovers once a 5xx fault's times are used up", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [{ method: "GET", path: "/demo/tasks", status: 503, times: 2 }],
  });
  const statuses = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    statuses.push((await request("GET", "/demo/tasks")).status);
  }
  expect(statuses).toStrictEqual([503, 503, 200]);
  expect((await control("GET", "/__mock/faults")).faults).toStrictEqual([]);
});

test("a fault can return a 4xx status", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [{ method: "GET", path: "/demo/tasks/:id", status: 409, times: 1 }],
  });
  const { status, body } = await request("GET", "/demo/tasks/task-01");
  expect([status, body.error.code]).toStrictEqual([409, 40900]);
});

test("a lasting fault can return a 2xx error object or a body that breaks the schema", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [
      { method: "POST", path: "/demo/tasks/:id/comments", code: 50010 },
      { method: "GET", path: "/demo/tasks/:id", malformed: true },
    ],
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const comment = await request("POST", "/demo/tasks/task-01/comments", {
      content: "正常的评论",
    });
    expect([comment.status, comment.body]).toStrictEqual([
      200,
      { error: { code: 50010, message: expect.any(String) } },
    ]);
  }
  const detail = await request("GET", "/demo/tasks/task-01");
  expect([detail.status, detail.body]).toStrictEqual([
    200,
    { unexpected: true },
  ]);

  const { faults } = await control("GET", "/__mock/faults");
  expect(faults.map((fault) => [fault.path, fault.times])).toStrictEqual([
    ["/demo/tasks/:id/comments", null],
    ["/demo/tasks/:id", null],
  ]);
});

test("a reset clears the faults", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [{ method: "GET", path: "/demo/tasks", status: 500 }],
  });
  await control("POST", "/__mock/reset", { paused: true });
  expect((await request("GET", "/demo/tasks")).status).toBe(200);
});

test("the default latency can change, a reset restores the startup value, and an invalid value returns 400", async () => {
  expect(await control("GET", "/__mock/latency")).toStrictEqual({
    latency_ms: 0,
  });
  await control("PUT", "/__mock/latency", { latency_ms: 50 });
  expect((await control("GET", "/__mock/latency")).latency_ms).toBe(50);
  const startedAt = performance.now();
  await request("GET", "/demo/tasks/task-01");
  expect(performance.now() - startedAt).toBeGreaterThanOrEqual(45);

  for (const latency_ms of [-1, 1.5, 30_001, "500"]) {
    const { status } = await request("PUT", "/__mock/latency", { latency_ms });
    expect(status, String(latency_ms)).toBe(400);
  }

  await control("POST", "/__mock/reset", { paused: true });
  expect((await control("GET", "/__mock/latency")).latency_ms).toBe(0);
});

test("an invalid fault config returns 400, and faults apply only to business endpoints", async () => {
  for (const fault of [
    { method: "GET", path: "/demo/tasks", status: 302 },
    { method: "POST", path: "/__mock/reset", status: 500 },
    { method: "GET", path: "/demo/tasks", times: 0 },
  ]) {
    const { status } = await request("PUT", "/__mock/faults", {
      faults: [fault],
    });
    expect(status, JSON.stringify(fault)).toBe(400);
  }
});

test("grants CORS only to local origins", async () => {
  const allowed = await fetch(`${mockApi.url}/demo/tasks`, {
    headers: { Origin: "http://127.0.0.1:3000" },
  });
  expect(allowed.headers.get("access-control-allow-origin")).toBe(
    "http://127.0.0.1:3000",
  );
  const foreign = await fetch(`${mockApi.url}/demo/tasks`, {
    headers: { Origin: "https://example.com" },
  });
  expect(foreign.headers.get("access-control-allow-origin")).toBe(null);
});

test("a CORS preflight returns the allowed methods and headers", async () => {
  const response = await fetch(`${mockApi.url}/demo/tasks/task-01`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "PATCH",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-origin")).toBe(
    "http://localhost:3000",
  );
  expect(response.headers.get("access-control-allow-methods")).toMatch(/PATCH/);
  expect(response.headers.get("access-control-allow-headers")).toMatch(
    /content-type/,
  );
});

test("a reset without paused keeps the current pause state", async () => {
  const fastApi = await startMockApi({
    port: 0,
    stepIntervalMs: 10,
    latencyMs: 0,
  });
  const post = (path, body) =>
    fetch(`${fastApi.url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    await post("/__mock/clock", { paused: true });
    await post("/__mock/reset", {});
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 60));
    const response = await fetch(`${fastApi.url}/demo/tasks/task-11`);
    expect((await response.json()).status).toBe("pending");
  } finally {
    await fastApi.close();
  }
});

test("the request log lists the route each business request matched since the reset, without control endpoints", async () => {
  await request("GET", "/demo/tasks/task-01");
  await request("GET", "/demo/tasks/task-01/comments");
  await request("GET", "/demo/tasks/task-02");

  const { requests } = await control("GET", "/__mock/requests");

  expect(
    requests.map(({ method, path, url }) => [method, path, url]),
  ).toStrictEqual([
    ["GET", "/demo/tasks/:id", "/demo/tasks/task-01"],
    ["GET", "/demo/tasks/:id/comments", "/demo/tasks/task-01/comments"],
    ["GET", "/demo/tasks/:id", "/demo/tasks/task-02"],
  ]);
  await control("POST", "/__mock/reset", { paused: true });
  expect((await control("GET", "/__mock/requests")).requests).toStrictEqual([]);
});

test("a missing task's detail returns 404", async () => {
  const { status, body } = await request("GET", "/demo/tasks/task-404");
  expect([status, body.error.code]).toStrictEqual([404, 40400]);
});

test("returns the URL of a Mock API already on the port", async () => {
  const port = Number(new URL(mockApi.url).port);
  expect(await findRunningMockApi(port)).toBe(mockApi.url);
});

test("returns null when nothing listens on the port", async () => {
  const port = await unusedPort();
  expect(await findRunningMockApi(port)).toBe(null);
});

test("throws when another service holds the port instead of taking it for the Mock API", async () => {
  const other = createHttpServer((req, res) => {
    res.statusCode = 404;
    res.end("not here");
  });
  await new Promise((resolve) => other.listen(0, "127.0.0.1", resolve));
  try {
    await expect(findRunningMockApi(other.address().port)).rejects.toThrow(
      /in use by something other than the Mock API/,
    );
  } finally {
    await new Promise((resolve) => other.close(resolve));
  }
});

async function unusedPort() {
  const probe = createHttpServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}
