import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { after, before, beforeEach, test } from "node:test";

import { findRunningMockApi, startMockApi } from "./server.mjs";

let mockApi;

before(async () => {
  mockApi = await startMockApi({ port: 0 });
});

after(() => mockApi.close());

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
  const { status, body: envelope } = await request(method, path, body);
  assert.equal(status, 200, JSON.stringify(envelope));
  assert.equal(envelope.code, 0, JSON.stringify(envelope));
  return envelope.data;
}

test("任务列表按创建时间倒序分页返回种子数据", async () => {
  const { status, body } = await request("GET", "/demo/tasks?page_size=5");

  assert.equal(status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.page, 1);
  assert.equal(body.data.page_size, 5);
  assert.equal(body.data.items.length, 5);
  assert.equal(body.data.has_more, true);
  const createdAt = body.data.items.map((task) => task.created_at);
  assert.deepEqual(
    createdAt,
    [...createdAt].sort((a, b) => b - a),
  );
  assert.deepEqual(Object.keys(body.data.items[0]).sort(), [
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
  assert.deepEqual(active.items.map((task) => task.status).sort(), [
    "pending",
    "pending",
    "running",
    "running",
  ]);

  const favorites = await control("GET", "/demo/tasks?favorite=true");
  assert.ok(favorites.items.length > 0);
  assert.ok(favorites.items.every((task) => task.favorite));

  const fox = await control("GET", "/demo/tasks/task-01");
  const related = await control(
    "GET",
    `/demo/tasks?prompt=${encodeURIComponent(fox.prompt)}&exclude_id=task-01`,
  );
  assert.deepEqual(related.items.map((task) => task.name).sort(), [
    "坐着的狐狸 v2",
    "橙色狐狸草稿",
  ]);
});

test("按名称排序", async () => {
  const page = await control("GET", "/demo/tasks?sort=name_asc&page_size=50");
  const names = page.items.map((task) => task.name);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b, "zh-CN")),
  );
});

test("创建的任务从 pending 开始，排在列表最前", async () => {
  const created = await control("POST", "/demo/tasks", {
    name: "  新的狐狸  ",
    prompt: "一只狐狸",
  });
  assert.equal(created.name, "新的狐狸");
  assert.equal(created.status, "pending");
  assert.equal(created.progress, 0);
  assert.equal(created.favorite, false);

  const page = await control("GET", "/demo/tasks?page_size=1");
  assert.equal(page.items[0].id, created.id);
});

test("名称已被占用时用业务 code 拒绝创建和重命名", async () => {
  const created = await request("POST", "/demo/tasks", {
    name: "低多边形狐狸",
    prompt: "一只狐狸",
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.code, 40901);

  const renamed = await request("PATCH", "/demo/tasks/task-02", {
    name: "低多边形狐狸",
  });
  assert.equal(renamed.body.code, 40901);

  const kept = await control("PATCH", "/demo/tasks/task-01", {
    name: "低多边形狐狸",
  });
  assert.equal(kept.name, "低多边形狐狸");
});

test("名称或 prompt 为空时返回 400", async () => {
  const { status } = await request("POST", "/demo/tasks", {
    name: " ",
    prompt: "一只狐狸",
  });
  assert.equal(status, 400);
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

  assert.deepEqual(progress, [
    ["running", 0],
    ["running", 25],
    ["running", 50],
    ["running", 75],
    ["running", 100],
  ]);
  assert.deepEqual([done.status, done.progress], ["done", 100]);
  assert.deepEqual(
    [(await advance(id)).status, (await advance(id)).progress],
    ["done", 100],
  );
});

test("名字里带 fail 的任务最终失败", async () => {
  const { id } = await control("POST", "/demo/tasks", {
    name: "fail 推进测试",
    prompt: "一只狐狸",
  });
  const task = await advance(id, 6);
  assert.equal(task.status, "failed");
});

test("没有暂停时任务按时间自动推进", async () => {
  const fastApi = await startMockApi({ port: 0, stepIntervalMs: 10 });
  try {
    const response = await fetch(`${fastApi.url}/demo/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "自动推进", prompt: "一只狐狸" }),
    });
    const { data: created } = await response.json();
    let status = created.status;
    for (let attempt = 0; attempt < 50 && status !== "done"; attempt += 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
      const detail = await fetch(`${fastApi.url}/demo/tasks/${created.id}`);
      status = (await detail.json()).data.status;
    }
    assert.equal(status, "done");
  } finally {
    await fastApi.close();
  }
});

test("暂停时任务不会自动推进", async () => {
  const fastApi = await startMockApi({ port: 0, stepIntervalMs: 10 });
  try {
    await fetch(`${fastApi.url}/__mock/clock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: true }),
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 60));
    const response = await fetch(`${fastApi.url}/demo/tasks/task-11`);
    assert.equal((await response.json()).data.status, "pending");
  } finally {
    await fastApi.close();
  }
});

test("只有 failed 的任务能重试，重试后回到 pending 并清空进度", async () => {
  const retried = await control("POST", "/demo/tasks/task-05/retry");
  assert.deepEqual([retried.status, retried.progress], ["pending", 0]);

  const again = await request("POST", "/demo/tasks/task-05/retry");
  assert.equal(again.status, 200);
  assert.equal(again.body.code, 40902);

  const done = await request("POST", "/demo/tasks/task-01/retry");
  assert.equal(done.body.code, 40902);
});

test("设置收藏", async () => {
  const favorited = await control("PUT", "/demo/tasks/task-02/favorite", {
    favorite: true,
  });
  assert.equal(favorited.favorite, true);
  const unfavorited = await control("PUT", "/demo/tasks/task-02/favorite", {
    favorite: false,
  });
  assert.equal(unfavorited.favorite, false);
});

test("删除任务时它的评论一起删除", async () => {
  assert.equal(
    (await control("GET", "/demo/tasks/task-01/comments")).items.length,
    2,
  );

  assert.equal(await control("DELETE", "/demo/tasks/task-01"), null);

  assert.equal((await request("GET", "/demo/tasks/task-01")).status, 404);
  assert.equal(
    (await request("GET", "/demo/tasks/task-01/comments")).status,
    404,
  );
});

test("评论按发表时间从早到晚排列，内容去掉首尾空白后为 1 到 500 字", async () => {
  const comment = await control("POST", "/demo/tasks/task-01/comments", {
    content: "  新评论  ",
  });
  assert.equal(comment.content, "新评论");
  assert.deepEqual(Object.keys(comment).sort(), [
    "content",
    "created_at",
    "id",
    "task_id",
  ]);

  const { items } = await control("GET", "/demo/tasks/task-01/comments");
  assert.equal(items.at(-1).id, comment.id);
  const createdAt = items.map((item) => item.created_at);
  assert.deepEqual(
    createdAt,
    [...createdAt].sort((a, b) => a - b),
  );

  for (const content of ["   ", "长".repeat(501)]) {
    const rejected = await request("POST", "/demo/tasks/task-01/comments", {
      content,
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.code, 40904);
  }
  const longest = await control("POST", "/demo/tasks/task-01/comments", {
    content: "长".repeat(500),
  });
  assert.equal(longest.content.length, 500);
});

test("删除评论", async () => {
  const { items } = await control("GET", "/demo/tasks/task-01/comments");
  assert.equal(
    await control("DELETE", `/demo/tasks/task-01/comments/${items[0].id}`),
    null,
  );
  const remaining = await control("GET", "/demo/tasks/task-01/comments");
  assert.deepEqual(
    remaining.items.map((item) => item.id),
    items.slice(1).map((item) => item.id),
  );
  const missing = await request(
    "DELETE",
    `/demo/tasks/task-01/comments/${items[0].id}`,
  );
  assert.equal(missing.status, 404);
});

test("搜索按名称和 prompt 匹配关键词，空关键词返回空列表", async () => {
  const { items } = await control(
    "GET",
    `/demo/tasks/search?term=${encodeURIComponent("狐狸")}`,
  );
  assert.deepEqual(items.map((task) => task.name).sort(), [
    "低多边形狐狸",
    "坐着的狐狸 v2",
    "橙色狐狸草稿",
  ]);
  const byPrompt = await control(
    "GET",
    `/demo/tasks/search?term=${encodeURIComponent("能量核心")}`,
  );
  assert.equal(byPrompt.items.length, 3);
  assert.deepEqual(
    (await control("GET", "/demo/tasks/search?term=%20")).items,
    [],
  );
});

test("作品广场只包含 done 的任务，分页供无限滚动使用", async () => {
  const first = await control("GET", "/demo/feed?page=1&page_size=6");
  const second = await control("GET", "/demo/feed?page=2&page_size=6");
  const last = await control("GET", "/demo/feed?page=3&page_size=6");

  const items = [...first.items, ...second.items, ...last.items];
  assert.ok(items.every((task) => task.status === "done"));
  assert.equal(new Set(items.map((task) => task.id)).size, items.length);
  assert.deepEqual(
    [first.has_more, second.has_more, last.has_more],
    [true, true, false],
  );
});

test("种子封面图可以读取，没有封面图的任务返回 404", async () => {
  const withCover = await control("GET", "/demo/tasks/task-01");
  assert.ok(
    withCover.cover_url.startsWith(`${mockApi.url}/demo/tasks/task-01/cover`),
  );
  const cover = await fetch(withCover.cover_url);
  assert.equal(cover.status, 200);
  assert.match(cover.headers.get("content-type"), /^image\//);

  const withoutCover = await control("GET", "/demo/tasks/task-03");
  assert.equal(withoutCover.cover_url, null);
  assert.equal(
    (await fetch(`${mockApi.url}/demo/tasks/task-03/cover`)).status,
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
  const { code, data: updated } = await response.json();

  assert.equal(code, 0);
  assert.notEqual(updated.cover_url, before.cover_url);
  const cover = await fetch(updated.cover_url);
  assert.equal(cover.headers.get("content-type"), "image/png");
  assert.deepEqual(new Uint8Array(await cover.arrayBuffer()), image);
});

test("上传的不是图片时返回 400", async () => {
  const form = new FormData();
  form.append("file", new Blob(["hello"], { type: "text/plain" }), "a.txt");
  const response = await fetch(`${mockApi.url}/demo/tasks/task-01/cover`, {
    method: "PUT",
    body: form,
  });
  assert.equal(response.status, 400);
});

test("done 的任务可以下载合法的 .glb 模型文件", async () => {
  const response = await fetch(`${mockApi.url}/demo/tasks/task-01/model`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "model/gltf-binary");
  assert.match(
    response.headers.get("content-disposition"),
    new RegExp(
      `filename\\*=UTF-8''${encodeURIComponent("低多边形狐狸")}\\.glb`,
    ),
  );
  const view = new DataView(await response.arrayBuffer());
  assert.equal(view.getUint32(0, true), 0x46546c67); // "glTF"
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), view.byteLength);
  const jsonLength = view.getUint32(12, true);
  assert.equal(view.getUint32(16, true), 0x4e4f534a); // "JSON"
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(view.buffer, 20, jsonLength)),
  );
  assert.equal(json.asset.version, "2.0");
  assert.equal(json.meshes.length, 1);
  assert.equal(view.getUint32(20 + jsonLength + 4, true), 0x004e4942); // "BIN"
});

test("没有完成的任务下载模型时返回业务 code", async () => {
  const response = await request("GET", "/demo/tasks/task-03/model");
  assert.equal(response.status, 200);
  assert.equal(response.body.code, 40903);
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
  assert.equal(response.headers.get("content-type"), "text/event-stream");

  const received = [];
  for await (const { event, data } of readEvents(response)) {
    if (event === "end") {
      received.push(["end", data.status]);
      break;
    }
    received.push([event, data.line]);
    if (received.length === 2) await advance("task-11", 4);
  }

  assert.deepEqual(received, [
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
  assert.equal(events.at(-1), "end");
  assert.ok(events.slice(0, -1).every((event) => event === "log"));
});

test("故障可以给接口加延迟", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [{ method: "GET", path: "/demo/tasks/:id", latency_ms: 150 }],
  });
  const startedAt = performance.now();
  const { body } = await request("GET", "/demo/tasks/task-01");
  assert.ok(performance.now() - startedAt >= 140);
  assert.equal(body.code, 0);
});

test("指定次数的 5xx 故障用完后接口恢复正常", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [{ method: "GET", path: "/demo/tasks", status: 503, times: 2 }],
  });
  const statuses = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    statuses.push((await request("GET", "/demo/tasks")).status);
  }
  assert.deepEqual(statuses, [503, 503, 200]);
  assert.deepEqual((await control("GET", "/__mock/faults")).faults, []);
});

test("故障可以返回 4xx 状态码", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [{ method: "GET", path: "/demo/tasks/:id", status: 409, times: 1 }],
  });
  const { status, body } = await request("GET", "/demo/tasks/task-01");
  assert.equal(status, 409);
  assert.notEqual(body.code, 0);
});

test("一直生效的故障可以返回失败的业务 code 或不符合 schema 的 data", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [
      { method: "POST", path: "/demo/tasks/:id/comments", code: 40904 },
      { method: "GET", path: "/demo/tasks/:id", malformed: true },
    ],
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const comment = await request("POST", "/demo/tasks/task-01/comments", {
      content: "正常的评论",
    });
    assert.deepEqual([comment.status, comment.body.code], [200, 40904]);
  }
  const detail = await request("GET", "/demo/tasks/task-01");
  assert.deepEqual(detail.body, {
    code: 0,
    data: { unexpected: true },
    message: "ok",
  });

  const { faults } = await control("GET", "/__mock/faults");
  assert.deepEqual(
    faults.map((fault) => [fault.path, fault.times]),
    [
      ["/demo/tasks/:id/comments", null],
      ["/demo/tasks/:id", null],
    ],
  );
});

test("重置会清除故障", async () => {
  await control("PUT", "/__mock/faults", {
    faults: [{ method: "GET", path: "/demo/tasks", status: 500 }],
  });
  await control("POST", "/__mock/reset", { paused: true });
  assert.equal((await request("GET", "/demo/tasks")).status, 200);
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
    assert.equal(status, 400, JSON.stringify(fault));
  }
});

test("只给本机的 origin 返回跨域许可", async () => {
  const allowed = await fetch(`${mockApi.url}/demo/tasks`, {
    headers: { Origin: "http://127.0.0.1:3000" },
  });
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "http://127.0.0.1:3000",
  );
  const foreign = await fetch(`${mockApi.url}/demo/tasks`, {
    headers: { Origin: "https://example.com" },
  });
  assert.equal(foreign.headers.get("access-control-allow-origin"), null);
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
  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "http://localhost:3000",
  );
  assert.match(response.headers.get("access-control-allow-methods"), /PATCH/);
  assert.match(
    response.headers.get("access-control-allow-headers"),
    /content-type/,
  );
});

test("重置时不传 paused 就保持当前的暂停状态", async () => {
  const fastApi = await startMockApi({ port: 0, stepIntervalMs: 10 });
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
    assert.equal((await response.json()).data.status, "pending");
  } finally {
    await fastApi.close();
  }
});

test("请求记录列出重置以来每次业务请求匹配的路由，不含控制接口", async () => {
  await request("GET", "/demo/tasks/task-01");
  await request("GET", "/demo/tasks/task-01/comments");
  await request("GET", "/demo/tasks/task-02");

  const { requests } = await control("GET", "/__mock/requests");

  assert.deepEqual(
    requests.map(({ method, path, url }) => [method, path, url]),
    [
      ["GET", "/demo/tasks/:id", "/demo/tasks/task-01"],
      ["GET", "/demo/tasks/:id/comments", "/demo/tasks/task-01/comments"],
      ["GET", "/demo/tasks/:id", "/demo/tasks/task-02"],
    ],
  );
  await control("POST", "/__mock/reset", { paused: true });
  assert.deepEqual((await control("GET", "/__mock/requests")).requests, []);
});

test("任务详情不存在时返回 404", async () => {
  const { status, body } = await request("GET", "/demo/tasks/task-404");
  assert.equal(status, 404);
  assert.notEqual(body.code, 0);
});

test("端口上已经有 Mock API 时返回它的地址", async () => {
  const port = Number(new URL(mockApi.url).port);
  assert.equal(await findRunningMockApi(port), mockApi.url);
});

test("端口上没有服务时返回 null", async () => {
  const port = await unusedPort();
  assert.equal(await findRunningMockApi(port), null);
});

test("端口被别的服务占用时报错，不把它当成 Mock API", async () => {
  const other = createHttpServer((req, res) => {
    res.statusCode = 404;
    res.end("not here");
  });
  await new Promise((resolve) => other.listen(0, "127.0.0.1", resolve));
  try {
    await assert.rejects(
      findRunningMockApi(other.address().port),
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
