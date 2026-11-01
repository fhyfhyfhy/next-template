import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createFaults, faultResponse, MAX_LATENCY_MS } from "./faults.mjs";
import {
  badRequest,
  created,
  httpError,
  list,
  noContent,
  notFound,
  paginated,
  success,
} from "./responses.mjs";
import { createStore, DomainError } from "./store.mjs";

/** A fixed port: the `NEXT_PUBLIC_API_BASE_URL` a build inlines must still work at start. */
export const DEFAULT_MOCK_API_PORT = 4010;
// A task takes 6 steps, about 9 seconds, from pending to a final status, so its detail page shows
// the progress moving.
const DEFAULT_STEP_INTERVAL_MS = 1500;
// The business endpoints' response latency, standing in for network and backend time so the
// demos' loading states are visible. The control endpoints get none.
const DEFAULT_LATENCY_MS = 500;

/**
 * Starts the Mock API. With `port: 0` the OS picks the port, for tests.
 * `latencyMs` is the business endpoints' default latency: the Fault lab can change it through
 * `/__mock/latency`, and a reset restores this value. A fault's `latency_ms` adds to it.
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function startMockApi({
  port = DEFAULT_MOCK_API_PORT,
  stepIntervalMs = DEFAULT_STEP_INTERVAL_MS,
  latencyMs = DEFAULT_LATENCY_MS,
} = {}) {
  const store = createStore();
  const clock = { paused: false };
  const timer = setInterval(() => {
    if (!clock.paused) store.advanceAll();
  }, stepIntervalMs);
  timer.unref();
  // `routes` is built after listen: the cover images' absolute URLs need the port.
  const context = {
    routes: [],
    faults: createFaults(),
    requestLog: [],
    latencyMs,
    initialLatencyMs: latencyMs,
    // How many times `/__mock/reset` has run, to spot requests a reset caught during their delay.
    resets: 0,
  };
  const server = createServer((req, res) => {
    void handle(context, req, res);
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  context.routes = createRoutes(store, clock, context, url);
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

/**
 * Finds a Mock API already running on `port`, so that, say, demo:build run while demo:dev is up
 * shares it. Returns null when nothing listens on the port; throws when another program holds it,
 * so the demos' requests never go to an unknown service.
 * @returns {Promise<string | null>}
 */
export async function findRunningMockApi(port) {
  const url = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(`${url}/__mock/faults`, {
      signal: AbortSignal.timeout(2000),
    });
    const body = await response.json();
    if (response.ok && Array.isArray(body?.faults)) {
      return url;
    }
  } catch (error) {
    if (error.cause?.code === "ECONNREFUSED") return null;
  }
  throw new Error(
    `Port ${port} is in use by something other than the Mock API; stop it or set MOCK_API_PORT`,
  );
}

function createRoutes(store, clock, context, publicUrl) {
  const { faults, requestLog } = context;
  const wireTask = (task) => toWireTask(task, publicUrl);
  return [
    route("GET", "/demo/tasks", ({ query }) =>
      paginated(
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
    route("POST", "/demo/tasks", ({ body }) =>
      created(wireTask(store.createTask(body ?? {}))),
    ),
    // Before /demo/tasks/:id, which would otherwise take search for a task id.
    route("GET", "/demo/tasks/search", ({ query }) =>
      list(store.searchTasks(query.get("term") ?? "").map(wireTask)),
    ),
    route("GET", "/demo/tasks/:id", ({ params }) =>
      success(wireTask(store.getTask(params.id))),
    ),
    route("PATCH", "/demo/tasks/:id", ({ params, body }) =>
      success(wireTask(store.renameTask(params.id, body ?? {}))),
    ),
    route("DELETE", "/demo/tasks/:id", ({ params }) => {
      store.deleteTask(params.id);
      return noContent();
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
        throw new DomainError(badRequest("Missing file field"));
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
      list(store.listComments(params.id).map(toWireComment)),
    ),
    route("POST", "/demo/tasks/:id/comments", ({ params, body }) =>
      created(toWireComment(store.addComment(params.id, body ?? {}))),
    ),
    route("DELETE", "/demo/tasks/:id/comments/:commentId", ({ params }) => {
      store.deleteComment(params.id, params.commentId);
      return noContent();
    }),
    route("GET", "/demo/feed", ({ query }) =>
      paginated(
        store.listFeed({
          page: integer(query.get("page"), 1),
          pageSize: integer(query.get("page_size"), 10),
        }),
        wireTask,
      ),
    ),
    // Without paused, the clock keeps its current state: when e2e pauses it and then resets from
    // the Fault lab, the clock stays paused.
    route("POST", "/__mock/reset", ({ body }) => {
      store.reset();
      faults.clear();
      requestLog.length = 0;
      context.latencyMs = context.initialLatencyMs;
      context.resets += 1;
      if (typeof body?.paused === "boolean") clock.paused = body.paused;
      return noContent();
    }),
    // e2e checks request counts with it, such as one request per endpoint during server rendering
    // and no repeated request from the browser after hydration.
    route("GET", "/__mock/requests", () => success({ requests: requestLog })),
    route("GET", "/__mock/faults", () => success({ faults: faults.list() })),
    route("PUT", "/__mock/faults", ({ body }) => {
      faults.replace(body?.faults);
      return success({ faults: faults.list() });
    }),
    route("GET", "/__mock/latency", () =>
      success({ latency_ms: context.latencyMs }),
    ),
    route("PUT", "/__mock/latency", ({ body }) => {
      const latencyMs = body?.latency_ms;
      if (
        !Number.isInteger(latencyMs) ||
        latencyMs < 0 ||
        latencyMs > MAX_LATENCY_MS
      ) {
        throw new DomainError(
          badRequest(
            `latency_ms must be an integer from 0 to ${MAX_LATENCY_MS}`,
            {
              param: "latency_ms",
            },
          ),
        );
      }
      context.latencyMs = latencyMs;
      return success({ latency_ms: latencyMs });
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

/** A `:name` segment in the path matches any one segment, and its value goes into `params`. */
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

async function handle(context, req, res) {
  const { routes, faults, requestLog, latencyMs } = context;
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
    const business = matched?.route.pattern.startsWith("/demo/") ?? false;
    if (business) {
      requestLog.push({
        method: req.method,
        path: matched.route.pattern,
        url: `${url.pathname}${url.search}`,
        at: Date.now(),
      });
    }
    const fault = matched && faults.take(req.method, matched.route.pattern);
    const delay = (business ? latencyMs : 0) + (fault?.latencyMs ?? 0);
    const resets = context.resets;
    if (delay > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
      // During the delay the request is still in flight. Once the client has disconnected (an
      // aborted request, a closed page) it is dropped: reading the body would throw and exit the
      // process. A write during whose delay the Mock API was reset is refused: an unfinished write
      // from the previous e2e test (such as one sent by a Server Action, which closing the page
      // does not abort) must not change the next test's reset data. Reads are handled as usual.
      if (req.socket.destroyed) return;
    }
    response = !matched
      ? notFound(`No route for ${req.method} ${url.pathname}`)
      : context.resets !== resets && req.method !== "GET"
        ? httpError(503, "The Mock API was reset before this write was handled")
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
  // A handler that returns undefined has written the response itself, such as a binary download
  // or SSE.
  if (response) sendResponse(res, response);
}

function findRoute(routes, method, pathname) {
  for (const candidate of routes) {
    if (candidate.method !== method) continue;
    const params = candidate.match(pathname);
    if (params) return { route: candidate, params };
  }
  return null;
}

// CORS is granted to local pages only: while pnpm demo:dev runs, other sites in the browser cannot
// read the responses, and their writes with a JSON body fail the preflight.
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function setCorsHeaders(req, res) {
  res.setHeader("Vary", "Origin");
  if (!LOCAL_ORIGIN.test(req.headers.origin ?? "")) return;
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
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
    throw new DomainError(badRequest("Request body is not valid JSON"));
  }
}

/** Node's built-in `Request.formData()` parses the multipart body, so no dependency is needed. */
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

/**
 * Pushes the existing logs first, then one `log` event per new log line; at a final status it
 * sends an `end` event and closes the connection.
 */
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
    // A retry clears the logs, so pushing starts over.
    if (current.logs.length < sent) sent = 0;
    if (flush(current)) unsubscribe();
  });
  req.on("close", unsubscribe);
}

function sendResponse(res, { status, body }) {
  res.statusCode = status;
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function integer(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toWireTask(task, publicUrl) {
  return {
    id: task.id,
    name: task.name,
    prompt: task.prompt,
    status: task.status,
    progress: task.progress,
    favorite: task.favorite,
    // The version changes the URL when the image is replaced, so the browser does not keep the
    // cached old one.
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
