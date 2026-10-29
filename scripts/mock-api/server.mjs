import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { badRequest, notFound, success } from "./envelope.mjs";
import { createFaults, faultResponse } from "./faults.mjs";
import { createStore, DomainError } from "./store.mjs";

/** 固定端口：build 时内联进产物的 `NEXT_PUBLIC_API_BASE_URL` 在 start 时必须仍然可用。 */
export const DEFAULT_MOCK_API_PORT = 4010;
// 一个任务从 pending 到终态要走 6 步，约 9 秒，停在详情页能看到进度推进。
const DEFAULT_STEP_INTERVAL_MS = 1500;

/**
 * 启动 Mock API。`port: 0` 时由系统分配端口，测试用。
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function startMockApi({
  port = DEFAULT_MOCK_API_PORT,
  stepIntervalMs = DEFAULT_STEP_INTERVAL_MS,
} = {}) {
  const store = createStore();
  const clock = { paused: false };
  const timer = setInterval(() => {
    if (!clock.paused) store.advanceAll();
  }, stepIntervalMs);
  timer.unref();
  const faults = createFaults();
  // 端口在 listen 之后才确定，路由要用它拼出封面图的绝对地址。
  let routes = [];
  const server = createServer((req, res) => {
    void handle(routes, faults, req, res);
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  routes = createRoutes(store, clock, faults, url);
  return {
    url,
    close: () =>
      new Promise((resolveClose) => {
        clearInterval(timer);
        server.closeAllConnections();
        server.close(() => resolveClose());
      }),
  };
}

function createRoutes(store, clock, faults, publicUrl) {
  const wireTask = (task) => toWireTask(task, publicUrl);
  return [
    route("GET", "/demo/tasks", ({ query }) =>
      success(
        toWirePage(
          store.listTasks({
            status: query.getAll("status"),
            favorite: query.has("favorite")
              ? query.get("favorite") === "true"
              : undefined,
            prompt: query.get("prompt") ?? undefined,
            excludeId: query.get("exclude_id") ?? undefined,
            sort: query.get("sort"),
            page: integer(query.get("page"), 1),
            pageSize: integer(query.get("page_size"), 10),
          }),
          wireTask,
        ),
      ),
    ),
    route("POST", "/demo/tasks", ({ body }) =>
      success(wireTask(store.createTask(body ?? {}))),
    ),
    // 放在 /demo/tasks/:id 之前，否则 search 会被当成任务 id。
    route("GET", "/demo/tasks/search", ({ query }) =>
      success({
        items: store.searchTasks(query.get("term") ?? "").map(wireTask),
      }),
    ),
    route("GET", "/demo/tasks/:id", ({ params }) =>
      success(wireTask(store.getTask(params.id))),
    ),
    route("PATCH", "/demo/tasks/:id", ({ params, body }) =>
      success(wireTask(store.renameTask(params.id, body ?? {}))),
    ),
    route("DELETE", "/demo/tasks/:id", ({ params }) => {
      store.deleteTask(params.id);
      return success(null);
    }),
    route("PUT", "/demo/tasks/:id/favorite", ({ params, body }) =>
      success(wireTask(store.setFavorite(params.id, body ?? {}))),
    ),
    route("POST", "/demo/tasks/:id/retry", ({ params }) =>
      success(wireTask(store.retryTask(params.id))),
    ),
    route("PUT", "/demo/tasks/:id/cover", async ({ params, req }) => {
      const file = (await readForm(req))?.get("file");
      if (!(file instanceof Blob)) {
        throw new DomainError(badRequest("缺少 file 字段"));
      }
      const task = store.setCover(params.id, {
        contentType: file.type,
        bytes: Buffer.from(await file.arrayBuffer()),
      });
      return success(wireTask(task));
    }),
    route("GET", "/demo/tasks/:id/cover", ({ params, res }) => {
      const cover = store.getCover(params.id);
      res.setHeader("Content-Type", cover.contentType);
      res.end(cover.bytes);
    }),
    route("GET", "/demo/tasks/:id/model", ({ params, res }) => {
      const model = store.getModel(params.id);
      res.setHeader("Content-Type", "model/gltf-binary");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(model.filename)}`,
      );
      res.end(model.bytes);
    }),
    route("GET", "/demo/tasks/:id/logs", ({ params, req, res }) => {
      streamLogs(store, store.getTask(params.id), req, res);
    }),
    route("GET", "/demo/tasks/:id/comments", ({ params }) =>
      success({ items: store.listComments(params.id).map(toWireComment) }),
    ),
    route("POST", "/demo/tasks/:id/comments", ({ params, body }) =>
      success(toWireComment(store.addComment(params.id, body ?? {}))),
    ),
    route("DELETE", "/demo/tasks/:id/comments/:commentId", ({ params }) => {
      store.deleteComment(params.id, params.commentId);
      return success(null);
    }),
    route("GET", "/demo/feed", ({ query }) =>
      success(
        toWirePage(
          store.listFeed({
            page: integer(query.get("page"), 1),
            pageSize: integer(query.get("page_size"), 10),
          }),
          wireTask,
        ),
      ),
    ),
    route("POST", "/__mock/reset", ({ body }) => {
      store.reset();
      faults.clear();
      clock.paused = body?.paused === true;
      return success(null);
    }),
    route("GET", "/__mock/faults", () => success({ faults: faults.list() })),
    route("PUT", "/__mock/faults", ({ body }) => {
      faults.replace(body?.faults);
      return success({ faults: faults.list() });
    }),
    route("POST", "/__mock/clock", ({ body }) => {
      clock.paused = body?.paused === true;
      return success({ paused: clock.paused });
    }),
    route("POST", "/__mock/tasks/:id/advance", ({ params }) =>
      success(wireTask(store.advanceTask(params.id))),
    ),
  ];
}

/** 路径里的 `:name` 段匹配任意一段，取值放进 `params`。 */
function route(method, pattern, handler) {
  const names = [];
  const source = pattern.replace(/:(\w+)/g, (_, name) => {
    names.push(name);
    return "([^/]+)";
  });
  const regex = new RegExp(`^${source}$`);
  return {
    method,
    pattern,
    handler,
    match(pathname) {
      const result = regex.exec(pathname);
      if (!result) return null;
      return Object.fromEntries(
        names.map((name, index) => [
          name,
          decodeURIComponent(result[index + 1]),
        ]),
      );
    },
  };
}

async function handle(routes, faults, req, res) {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  const url = new URL(req.url, "http://mock.local");
  let response;
  try {
    const matched = findRoute(routes, req.method, url.pathname);
    const fault = matched && faults.take(req.method, matched.route.pattern);
    if (fault?.latencyMs) {
      await new Promise((resolveDelay) =>
        setTimeout(resolveDelay, fault.latencyMs),
      );
    }
    response = !matched
      ? notFound(`No route for ${req.method} ${url.pathname}`)
      : ((fault && faultResponse(fault)) ??
        (await matched.route.handler({
          params: matched.params,
          query: url.searchParams,
          body: await readJson(req),
          req,
          res,
        })));
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    response = error.response;
  }
  // 返回 undefined 的 handler 自己写完了响应，比如二进制下载和 SSE。
  if (response) sendJson(res, response);
}

function findRoute(routes, method, pathname) {
  for (const candidate of routes) {
    if (candidate.method !== method) continue;
    const params = candidate.match(pathname);
    if (params) return { route: candidate, params };
  }
  return null;
}

function setCorsHeaders(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] ?? "Content-Type",
  );
}

async function readJson(req) {
  if (!req.headers["content-type"]?.includes("application/json")) return null;
  let text = "";
  for await (const chunk of req) text += chunk;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError(badRequest("请求体不是合法的 JSON"));
  }
}

/** multipart 请求体交给 Node 自带的 `Request.formData()` 解析，不引入依赖。 */
async function readForm(req) {
  if (!req.headers["content-type"]?.includes("multipart/form-data")) {
    return null;
  }
  const request = new Request("http://mock.local", {
    method: req.method,
    headers: { "content-type": req.headers["content-type"] },
    body: req,
    duplex: "half",
  });
  return request.formData();
}

/** 先推送已有日志，之后每条新日志一个 `log` 事件，到终态时发送 `end` 事件并关闭连接。 */
function streamLogs(store, task, req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  let sent = 0;
  const flush = (current) => {
    for (; sent < current.logs.length; sent += 1) {
      res.write(
        `event: log\ndata: ${JSON.stringify({ line: current.logs[sent] })}\n\n`,
      );
    }
    if (current.status === "done" || current.status === "failed") {
      res.end(
        `event: end\ndata: ${JSON.stringify({ status: current.status })}\n\n`,
      );
      return true;
    }
    return false;
  };
  if (flush(task)) return;
  const unsubscribe = store.subscribe(task.id, (current) => {
    // 重试会清空日志，从头推送。
    if (current.logs.length < sent) sent = 0;
    if (flush(current)) unsubscribe();
  });
  req.on("close", unsubscribe);
}

function sendJson(res, { status, body }) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function integer(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toWirePage({ items, total, page, pageSize, hasMore }, toWire) {
  return {
    items: items.map(toWire),
    total,
    page,
    page_size: pageSize,
    has_more: hasMore,
  };
}

function toWireTask(task, publicUrl) {
  return {
    id: task.id,
    name: task.name,
    prompt: task.prompt,
    status: task.status,
    progress: task.progress,
    favorite: task.favorite,
    // 带上版本号，换图后地址变化，浏览器不会继续用缓存里的旧图。
    cover_url: task.cover
      ? `${publicUrl}/demo/tasks/${task.id}/cover?v=${task.cover.version}`
      : null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

function toWireComment(comment) {
  return {
    id: comment.id,
    task_id: comment.taskId,
    content: comment.content,
    created_at: comment.createdAt,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const mockApi = await startMockApi({
    port: integer(process.env.MOCK_API_PORT, DEFAULT_MOCK_API_PORT),
  });
  console.log(`Mock API listening on ${mockApi.url}`);
}
