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

test("任务列表按创建时间倒序分页返回种子数据", async () => {
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

test("任务列表按状态、收藏和 prompt 过滤，status 可以重复传多个", async () => {
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

test("按名称排序", async () => {
  const page = await control("GET", "/demo/tasks?sort=name_asc&page_size=50");
  const names = page.items.map((task) => task.name);
  expect(names).toStrictEqual(
    [...names].sort((a, b) => a.localeCompare(b, "zh-CN")),
  );
});

test("创建的任务从 pending 开始，排在列表最前", async () => {
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

test("名称已被占用时返回 409 和业务 code 拒绝创建和重命名，param 指向 name", async () => {
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

test("名称或 prompt 为空时返回 400，param 和 params 说明出错的字段和长度上限", async () => {
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

test("推进接口让任务一步步走到 done", async () => {
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

test("名字里带 fail 的任务最终失败", async () => {
  const { id } = await control("POST", "/demo/tasks", {
    name: "fail 推进测试",
    prompt: "一只狐狸",
  });
  const task = await advance(id, 6);
  expect(task.status).toBe("failed");
});

test("没有暂停时任务按时间自动推进", async () => {
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

test("暂停时任务不会自动推进", async () => {
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

test("只有 failed 的任务能重试，重试后回到 pending 并清空进度", async () => {
  const retried = await control("POST", "/demo/tasks/task-05/retry");
  expect([retried.status, retried.progress]).toStrictEqual(["pending", 0]);

  const again = await request("POST", "/demo/tasks/task-05/retry");
  expect([again.status, again.body.error.code]).toStrictEqual([409, 40902]);

  const done = await request("POST", "/demo/tasks/task-01/retry");
  expect(done.body.error.code).toBe(40902);
});

test("设置收藏", async () => {
  const favorited = await control("PUT", "/demo/tasks/task-02/favorite", {
    favorite: true,
  });
  expect(favorited.favorite).toBe(true);
  const unfavorited = await control("PUT", "/demo/tasks/task-02/favorite", {
    favorite: false,
  });
  expect(unfavorited.favorite).toBe(false);
});

test("删除任务时它的评论一起删除", async () => {
  expect(
    (await control("GET", "/demo/tasks/task-01/comments")).items.length,
  ).toBe(2);

  expect(await control("DELETE", "/demo/tasks/task-01")).toBe(null);

  expect((await request("GET", "/demo/tasks/task-01")).status).toBe(404);
  expect((await request("GET", "/demo/tasks/task-01/comments")).status).toBe(
    404,
  );
});

test("评论按发表时间从早到晚排列，内容去掉首尾空白后为 1 到 500 字", async () => {
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

test("删除评论", async () => {
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

test("搜索按名称和 prompt 匹配关键词，空关键词返回空列表", async () => {
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

test("作品广场只包含 done 的任务，分页供无限滚动使用", async () => {
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

test("种子封面图可以读取，没有封面图的任务返回 404", async () => {
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

test("上传图片替换封面图，封面地址随之变化", async () => {
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

test("上传的不是图片时返回 400", async () => {
  const form = new FormData();
  form.append("file", new Blob(["hello"], { type: "text/plain" }), "a.txt");
  const response = await fetch(`${mockApi.url}/demo/tasks/task-01/cover`, {
    method: "PUT",
    body: form,
  });
  expect(response.status).toBe(400);
});

test("done 的任务可以下载合法的 .glb 模型文件", async () => {
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

test("没有完成的任务下载模型时返回 409 和业务 code", async () => {
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

test("生成日志用 SSE 推送已有日志和新日志，到终态后结束", async () => {
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

test("已在终态的任务推送全部日志后立即结束", async () => {
  const response = await fetch(`${mockApi.url}/demo/tasks/task-05/logs`);
  const events = [];
  for await (const event of readEvents(response)) events.push(event.event);
  expect(events.at(-1)).toBe("end");
  expect(events.slice(0, -1).filter((event) => event !== "log")).toStrictEqual(
    [],
  );
});

test("故障可以给接口加延迟", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [{ method: "GET", path: "/demo/tasks/:id", latency_ms: 150 }],
  });
  const startedAt = performance.now();
  const { body } = await request("GET", "/demo/tasks/task-01");
  expect(performance.now() - startedAt).toBeGreaterThanOrEqual(140);
  expect(body.id).toBe("task-01");
});

test("业务接口有默认延迟，故障的延迟叠加在它之上，控制接口不加延迟", async () => {
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

test("延迟期间客户端断开的请求不再处理", async () => {
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

test("延迟期间赶上重置的写请求返回 503，不改动重置后的数据；读请求照常返回", async () => {
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

test("指定次数的 5xx 故障用完后接口恢复正常", async () => {
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

test("故障可以返回 4xx 状态码", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [{ method: "GET", path: "/demo/tasks/:id", status: 409, times: 1 }],
  });
  const { status, body } = await request("GET", "/demo/tasks/task-01");
  expect([status, body.error.code]).toStrictEqual([409, 40900]);
});

test("一直生效的故障可以返回 2xx 的 error 对象或不符合 schema 的响应体", async () => {
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

test("重置会清除故障", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [{ method: "GET", path: "/demo/tasks", status: 500 }],
  });
  await control("POST", "/__mock/reset", { paused: true });
  expect((await request("GET", "/demo/tasks")).status).toBe(200);
});

test("默认延迟可以修改，重置后恢复成启动时的值，不合法的值返回 400", async () => {
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

test("不合法的故障配置返回 400，故障只能配置在业务接口上", async () => {
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

test("只给本机的 origin 返回跨域许可", async () => {
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

test("跨域预检请求返回允许的方法和请求头", async () => {
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

test("重置时不传 paused 就保持当前的暂停状态", async () => {
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

test("请求记录列出重置以来每次业务请求匹配的路由，不含控制接口", async () => {
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

test("任务详情不存在时返回 404", async () => {
  const { status, body } = await request("GET", "/demo/tasks/task-404");
  expect([status, body.error.code]).toStrictEqual([404, 40400]);
});

test("端口上已经有 Mock API 时返回它的地址", async () => {
  const port = Number(new URL(mockApi.url).port);
  expect(await findRunningMockApi(port)).toBe(mockApi.url);
});

test("端口上没有服务时返回 null", async () => {
  const port = await unusedPort();
  expect(await findRunningMockApi(port)).toBe(null);
});

test("端口被别的服务占用时报错，不把它当成 Mock API", async () => {
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
