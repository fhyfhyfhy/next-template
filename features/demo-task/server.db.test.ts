import { beforeEach, describe, expect, test } from "vitest";

import { UPLOAD_ALREADY_USED } from "@/features/demo-upload";
import { createUpload } from "@/features/demo-upload/server";
import { DomainError, ErrorCode } from "@/lib/domain-error";

import {
  COMMENT_CONTENT_INVALID,
  TASK_NAME_TAKEN,
  TASK_NOT_DONE,
  TASK_NOT_RETRYABLE,
} from "./constants/error-codes";
import {
  advanceActiveTasks,
  advanceTask,
  createComment,
  createTask,
  deleteComment,
  deleteTask,
  demoRoute,
  getDefaultLatency,
  getTask,
  getTaskModelUrl,
  listCalls,
  listComments,
  listFaults,
  listFeed,
  listTasks,
  renameTask,
  replaceFaults,
  resetDemo,
  retryTask,
  searchTasks,
  setClockPaused,
  setDefaultLatency,
  setTaskCover,
  setTaskFavorite,
  startDemoGenerator,
  streamTaskLogs,
} from "./server";
import type { DemoFault } from "./types/demo-fault";
import {
  feedPageSchema,
  taskCommentSchema,
  taskPageSchema,
  taskSchema,
} from "./types/task";

// Demo 后端的数据层，经 server.ts 入口调用，连接真实的 Postgres 和对象存储（pnpm demo:test）。
// 每个测试从种子数据开始，时钟暂停，默认延迟为 0。

beforeEach(async () => {
  await resetDemo({ paused: true });
  await setDefaultLatency(0);
});

/** 读函数的返回值要符合对外的 schema，并且经过一次 JSON 往返后不变：浏览器 refetch 拿到的就是这个值。 */
function expectWireSafe<T>(schema: { parse: (value: unknown) => T }, value: T) {
  expect(schema.parse(JSON.parse(JSON.stringify(value)))).toStrictEqual(value);
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof DomainError)) {
    throw new Error(`Expected a DomainError, got ${String(error)}`);
  }
  const { status, code, param, params } = error;
  return { status, code, param, params };
}

/** 一个 1×1 的 PNG。 */
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

/** 按浏览器的做法上传一个文件：签发上传、直传对象存储，返回上传的 id。 */
async function uploadImage(contentType: string, body: Uint8Array<ArrayBuffer>) {
  const { id, uploadUrl } = await createUpload({
    purpose: "task-cover",
    contentType,
    size: body.byteLength,
  });
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  expect(response.status).toBe(200);
  return id;
}

async function advance(id: string, steps: number) {
  let task;
  for (let step = 0; step < steps; step += 1) task = await advanceTask(id);
  return task;
}

type LogEvent = { type: "log"; line: string } | { type: "end"; status: string };

/**
 * 读任务日志的 SSE 流，直到读满 `count` 个事件、流结束或 `timeoutMs` 内没有新事件，返回读到的事件。
 * `onEvent` 在每个事件到达后调用，测试在其中推进任务、观察新日志推送过来。
 */
async function readLogs(
  taskId: string,
  count: number,
  {
    timeoutMs = 300,
    onEvent,
  }: { timeoutMs?: number; onEvent?: (index: number) => Promise<void> } = {},
): Promise<LogEvent[]> {
  const controller = new AbortController();
  const stream = await streamTaskLogs(taskId, controller.signal);
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  const events: LogEvent[] = [];
  let buffer = "";
  try {
    while (events.length < count) {
      const result = await Promise.race([
        reader.read(),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), timeoutMs),
        ),
      ]);
      if (!result || result.done) break;
      buffer += result.value;
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const name = /^event: (.+)$/m.exec(block)?.[1];
        const data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? "null");
        events.push(
          name === "end" ? { type: "end", ...data } : { type: "log", ...data },
        );
        await onEvent?.(events.length);
      }
    }
  } finally {
    controller.abort();
    await reader.cancel().catch(() => {});
  }
  return events;
}

describe("任务列表", () => {
  test("按创建时间倒序分页返回种子数据", async () => {
    const page = await listTasks({ pageSize: 5 });

    expect(page.items.map((task) => task.id)).toStrictEqual([
      "task-20",
      "task-19",
      "task-18",
      "task-17",
      "task-16",
    ]);
    expect([page.total, page.page, page.pageSize, page.hasMore]).toStrictEqual([
      20,
      1,
      5,
      true,
    ]);
    expectWireSafe(taskPageSchema, page);
  });

  test("页码超出范围时返回空列表，每页最多 50 条", async () => {
    expect((await listTasks({ page: 5, pageSize: 5 })).items).toStrictEqual([]);
    expect((await listTasks({ pageSize: 500 })).pageSize).toBe(50);
  });

  test("按状态（可多选）、收藏、prompt 过滤，可以排除一个任务", async () => {
    const active = await listTasks({ status: ["pending", "running"] });
    expect(active.items.map((task) => task.id).sort()).toStrictEqual([
      "task-03",
      "task-11",
      "task-16",
      "task-19",
    ]);

    const favorites = await listTasks({ favorite: true });
    expect(favorites.items.map((task) => task.id).sort()).toStrictEqual([
      "task-01",
      "task-04",
      "task-08",
      "task-13",
    ]);

    const related = await listTasks({
      prompt: "一只低多边形风格的狐狸，坐姿，橙白配色",
      excludeId: "task-01",
    });
    expect(related.items.map((task) => task.name)).toStrictEqual([
      "橙色狐狸草稿",
      "坐着的狐狸 v2",
    ]);
  });

  test("按名称排序时中文按拼音排列，和浏览器的 zh-CN 排序一致", async () => {
    const page = await listTasks({ sort: "name_asc", pageSize: 50 });
    const names = page.items.map((task) => task.name);
    expect(names).toStrictEqual(
      [...names].sort((a, b) => a.localeCompare(b, "zh-CN")),
    );
  });

  test("按创建时间正序排列", async () => {
    const page = await listTasks({ sort: "created_asc", pageSize: 3 });
    expect(page.items.map((task) => task.id)).toStrictEqual([
      "task-01",
      "task-02",
      "task-03",
    ]);
  });
});

describe("任务的写入", () => {
  test("新建的任务去掉名称首尾空白，从 pending 开始，排在列表最前", async () => {
    const created = await createTask({
      name: "  新的狐狸  ",
      prompt: "一只狐狸",
    });

    expect(created).toMatchObject({
      name: "新的狐狸",
      status: "pending",
      progress: 0,
      favorite: false,
      coverUrl: null,
    });
    expect((await listTasks({ pageSize: 1 })).items[0].id).toBe(created.id);
    expectWireSafe(taskSchema, await getTask(created.id));
  });

  test("名称已被占用时按 TASK_NAME_TAKEN 拒绝创建和重命名，改成自己原来的名称不算冲突", async () => {
    expect(
      await rejection(createTask({ name: "低多边形狐狸", prompt: "一只狐狸" })),
    ).toStrictEqual({
      status: 409,
      code: TASK_NAME_TAKEN,
      param: "name",
      params: undefined,
    });
    expect(
      (await rejection(renameTask("task-02", { name: "低多边形狐狸" }))).code,
    ).toBe(TASK_NAME_TAKEN);
    expect((await renameTask("task-01", { name: "低多边形狐狸" })).name).toBe(
      "低多边形狐狸",
    );
  });

  test("名称为空或超过 40 字时按参数错误拒绝，params 带上限", async () => {
    expect(
      await rejection(createTask({ name: " ", prompt: "一只狐狸" })),
    ).toStrictEqual({
      status: 400,
      code: ErrorCode.BAD_REQUEST,
      param: "name",
      params: { max: 40 },
    });
    expect(
      (await rejection(renameTask("task-01", { name: "长".repeat(41) }))).param,
    ).toBe("name");
    expect(
      (await rejection(createTask({ name: "新任务", prompt: "" }))).param,
    ).toBe("prompt");
  });

  test("设置和取消收藏", async () => {
    expect(
      (await setTaskFavorite("task-02", { favorite: true })).favorite,
    ).toBe(true);
    expect(
      (await setTaskFavorite("task-02", { favorite: false })).favorite,
    ).toBe(false);
  });

  test("只有 failed 的任务能重试，重试后回到 pending、进度归零、日志清空", async () => {
    const retried = await retryTask("task-05");
    expect([retried.status, retried.progress]).toStrictEqual(["pending", 0]);
    expect(await readLogs("task-05", 1)).toStrictEqual([]);

    expect((await rejection(retryTask("task-05"))).code).toBe(
      TASK_NOT_RETRYABLE,
    );
    expect((await rejection(retryTask("task-01"))).code).toBe(
      TASK_NOT_RETRYABLE,
    );
  });

  test("删除任务时它的评论一起删除，之后读取返回 404", async () => {
    expect(await listComments("task-01")).toHaveLength(2);

    await deleteTask("task-01");

    expect((await rejection(getTask("task-01"))).status).toBe(404);
    expect((await rejection(listComments("task-01"))).status).toBe(404);
    expect((await rejection(deleteTask("task-01"))).status).toBe(404);
  });

  test("不存在的任务按 404 拒绝", async () => {
    expect(await rejection(getTask("task-99"))).toStrictEqual({
      status: 404,
      code: ErrorCode.NOT_FOUND,
      param: undefined,
      params: undefined,
    });
  });
});

describe("评论", () => {
  test("按发表时间从早到晚排列", async () => {
    const comments = await listComments("task-01");
    expect(comments.map((comment) => comment.content)).toStrictEqual([
      "耳朵的面数可以再少一点，更有低多边形的感觉。",
      "配色很好，导出给游戏原型用了。",
    ]);
    for (const comment of comments) expectWireSafe(taskCommentSchema, comment);
  });

  test("发表的评论去掉首尾空白排在最后，空评论和超过 500 字的评论按 COMMENT_CONTENT_INVALID 拒绝", async () => {
    const created = await createComment("task-01", { content: "  第三条  " });
    expect(created).toMatchObject({ taskId: "task-01", content: "第三条" });
    expect((await listComments("task-01")).at(-1)?.id).toBe(created.id);

    expect(
      await rejection(createComment("task-01", { content: "  " })),
    ).toStrictEqual({
      status: 400,
      code: COMMENT_CONTENT_INVALID,
      param: "content",
      params: { max: 500 },
    });
    expect(
      (await rejection(createComment("task-01", { content: "长".repeat(501) })))
        .code,
    ).toBe(COMMENT_CONTENT_INVALID);
  });

  test("删除评论，评论不属于这个任务时 404", async () => {
    await deleteComment("task-01", "comment-01");
    expect(await listComments("task-01")).toHaveLength(1);
    expect(
      (await rejection(deleteComment("task-04", "comment-02"))).status,
    ).toBe(404);
  });
});

describe("搜索", () => {
  test("按名称和 prompt 匹配关键词，不区分大小写，按创建时间倒序", async () => {
    const byPrompt = await searchTasks("狐狸");
    expect(byPrompt.map((task) => task.id)).toStrictEqual([
      "task-03",
      "task-02",
      "task-01",
    ]);
    expect((await searchTasks("FAIL")).map((task) => task.id)).toStrictEqual([
      "task-15",
      "task-09",
      "task-05",
    ]);
  });

  test("空关键词返回空列表，% 和 _ 按普通字符匹配", async () => {
    expect(await searchTasks("   ")).toStrictEqual([]);
    expect(await searchTasks("%")).toStrictEqual([]);
    expect(await searchTasks("_")).toStrictEqual([]);
  });
});

describe("作品广场", () => {
  test("只含 done 的任务，按创建时间倒序，用游标翻到最后一页", async () => {
    const first = await listFeed(null, 6);
    expect(first.items.map((task) => task.id)).toStrictEqual([
      "task-20",
      "task-18",
      "task-17",
      "task-14",
      "task-13",
      "task-12",
    ]);
    expectWireSafe(feedPageSchema, first);

    const second = await listFeed(first.nextCursor, 6);
    expect(second.items.map((task) => task.id)).toStrictEqual([
      "task-10",
      "task-08",
      "task-07",
      "task-06",
      "task-04",
      "task-02",
    ]);
    const last = await listFeed(second.nextCursor, 6);
    expect(last.items.map((task) => task.id)).toStrictEqual(["task-01"]);
    expect(last.nextCursor).toBeNull();
  });

  test("翻页期间有任务完成、排到最前，下一页不会重复上一页的任务", async () => {
    const first = await listFeed(null, 6);
    const { id } = await createTask({
      name: "翻页期间完成",
      prompt: "一只狐狸",
    });
    await advance(id, 6);

    const second = await listFeed(first.nextCursor, 6);
    expect(second.items[0].id).toBe("task-10");
    expect((await listFeed(null, 1)).items[0].id).toBe(id);
  });
});

describe("Demo 生成器", () => {
  test("一步步把任务从 pending 推进到 done，之后不再变化", async () => {
    const { id } = await createTask({ name: "推进测试", prompt: "一只狐狸" });

    const steps = [];
    for (let step = 0; step < 6; step += 1) {
      const task = await advanceTask(id);
      steps.push([task.status, task.progress]);
    }
    const after = await advanceTask(id);

    expect(steps).toStrictEqual([
      ["running", 0],
      ["running", 25],
      ["running", 50],
      ["running", 75],
      ["running", 100],
      ["done", 100],
    ]);
    expect([after.status, after.progress]).toStrictEqual(["done", 100]);
  });

  test("名称里带 fail 的任务最终失败", async () => {
    const { id } = await createTask({
      name: "Fail 推进测试",
      prompt: "一只狐狸",
    });
    expect((await advance(id, 6))?.status).toBe("failed");
  });

  test("时钟暂停时不自动推进，恢复后每个活跃任务各推进一步", async () => {
    await advanceActiveTasks();
    expect((await getTask("task-11")).status).toBe("pending");

    await setClockPaused(false);
    await advanceActiveTasks();
    expect((await getTask("task-11")).status).toBe("running");
    expect((await getTask("task-03")).progress).toBe(75);
    expect((await getTask("task-01")).status).toBe("done");
  });

  test("后台运行时自己推进到终态", async () => {
    const { id } = await createTask({ name: "自动推进", prompt: "一只狐狸" });
    await setClockPaused(false);
    const stop = startDemoGenerator({ intervalMs: 20 });
    try {
      await expect
        .poll(async () => (await getTask(id)).status, { timeout: 5000 })
        .toBe("done");
    } finally {
      await stop();
    }
  });
});

describe("生成日志", () => {
  test("已在终态的任务推送全部日志后以 end 结束", async () => {
    expect(await readLogs("task-05", 10)).toStrictEqual([
      { type: "log", line: "开始生成" },
      { type: "log", line: "解析 prompt" },
      { type: "log", line: "生成网格" },
      { type: "log", line: "生成失败：材质计算出错" },
      { type: "end", status: "failed" },
    ]);
  });

  test("先推送已有日志，任务推进时推送新日志，到终态后结束", async () => {
    // task-03 是 50% 的 running 任务：已有 3 条日志，还要推进 3 步才完成。
    const events = await readLogs("task-03", 10, {
      timeoutMs: 2000,
      onEvent: async (index) => {
        if (index >= 3) await advanceTask("task-03");
      },
    });
    expect(events).toStrictEqual([
      { type: "log", line: "开始生成" },
      { type: "log", line: "解析 prompt" },
      { type: "log", line: "生成网格" },
      { type: "log", line: "生成贴图" },
      { type: "log", line: "优化拓扑" },
      { type: "log", line: "生成完成" },
      { type: "end", status: "done" },
    ]);
  });

  test("不存在的任务按 404 拒绝", async () => {
    expect(
      (await rejection(streamTaskLogs("task-99", new AbortController().signal)))
        .status,
    ).toBe(404);
  });
});

describe("模型文件", () => {
  test("done 的任务可以下载 .glb，文件名是任务名", async () => {
    const response = await fetch(await getTaskModelUrl("task-01"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename*=UTF-8''${encodeURIComponent("低多边形狐狸.glb")}`,
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    // glb 文件头：magic "glTF"、版本 2、总长度。
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("glTF");
    expect(new DataView(bytes.buffer).getUint32(8, true)).toBe(bytes.length);
  });

  test("任务完成时产出模型，没完成时按 TASK_NOT_DONE 拒绝", async () => {
    const { id } = await createTask({ name: "模型测试", prompt: "一只狐狸" });
    expect((await rejection(getTaskModelUrl(id))).code).toBe(TASK_NOT_DONE);

    await advance(id, 6);

    expect((await fetch(await getTaskModelUrl(id))).status).toBe(200);
  });
});

describe("封面", () => {
  test("种子任务的封面可以直接读取，没有封面的任务为 null", async () => {
    const withCover = await getTask("task-01");
    const response = await fetch(withCover.coverUrl ?? "");
    expect([
      response.status,
      response.headers.get("content-type"),
    ]).toStrictEqual([200, "image/svg+xml"]);
    expect((await getTask("task-03")).coverUrl).toBeNull();
  });

  test("上传图片后设为封面，封面地址换成新文件，重复提交同一次上传不报错", async () => {
    const uploadId = await uploadImage("image/png", PNG);

    const task = await setTaskCover("task-03", { uploadId });
    const again = await setTaskCover("task-03", { uploadId });

    expect(again.coverUrl).toBe(task.coverUrl);
    const response = await fetch(task.coverUrl ?? "");
    expect(new Uint8Array(await response.arrayBuffer())).toStrictEqual(PNG);
    expect(
      (
        await listTasks({ excludeId: "task-01", prompt: task.prompt })
      ).items.find((item) => item.id === "task-03")?.coverUrl,
    ).toBe(task.coverUrl);
  });

  test("一次上传只能给一个任务做封面", async () => {
    const uploadId = await uploadImage("image/png", PNG);
    await setTaskCover("task-03", { uploadId });

    expect((await rejection(setTaskCover("task-11", { uploadId }))).code).toBe(
      UPLOAD_ALREADY_USED,
    );
  });

  test("不存在的任务按 404 拒绝", async () => {
    const uploadId = await uploadImage("image/png", PNG);
    expect(
      (await rejection(setTaskCover("task-99", { uploadId }))).status,
    ).toBe(404);
  });
});

const fault = (overrides: Partial<DemoFault>): DemoFault => ({
  operation: "task.get",
  kind: "latency",
  latencyMs: 0,
  code: null,
  status: null,
  times: null,
  ...overrides,
});

/** 像浏览器经 Route Handler 那样调用：同样经过 `demoRoute` 适配层。 */
const getTaskOverHttp = demoRoute(async () => getTask("task-01"));

async function callOverHttp() {
  const response = await getTaskOverHttp(
    new Request("http://localhost/api/demo/tasks/task-01"),
    {},
  );
  return { status: response.status, body: await response.json() };
}

async function elapsed(run: () => Promise<unknown>) {
  const start = Date.now();
  await run().catch(() => {});
  return Date.now() - start;
}

describe("故障实验室", () => {
  test("业务操作有默认延迟，可以修改；重置后恢复成 500 ms，不合法的值按参数错误拒绝", async () => {
    await setDefaultLatency(200);
    expect(await elapsed(() => getTask("task-01"))).toBeGreaterThanOrEqual(200);

    await resetDemo();
    expect(await getDefaultLatency()).toBe(500);
    expect((await rejection(setDefaultLatency(30_001))).param).toBe(
      "latencyMs",
    );
    expect((await rejection(setDefaultLatency(1.5))).param).toBe("latencyMs");
  });

  test("故障的延迟叠加在默认延迟之上", async () => {
    await replaceFaults([fault({ latencyMs: 300, times: 1 })]);
    expect(await elapsed(() => getTask("task-01"))).toBeGreaterThanOrEqual(300);
    expect(await elapsed(() => getTask("task-01"))).toBeLessThan(300);
  });

  test("意外错误和业务错误码对服务端调用和 HTTP 调用都生效", async () => {
    await replaceFaults([
      fault({ kind: "unexpected", times: 1 }),
      fault({ kind: "businessError", code: 40999, status: 409, times: 1 }),
    ]);

    await expect(getTask("task-01")).rejects.toThrow(/Injected unexpected/);
    expect(await callOverHttp()).toStrictEqual({
      status: 409,
      body: { error: { code: 40999, message: expect.any(String) } },
    });
    expect((await callOverHttp()).status).toBe(200);
  });

  test("指定状态码、2xx 带 error、坏响应体只在 HTTP 调用上生效，服务端调用不消耗它们", async () => {
    await replaceFaults([
      fault({ kind: "httpStatus", status: 503, times: 1 }),
      fault({ kind: "errorOnSuccess", code: 50010, times: 1 }),
      fault({ kind: "malformed", times: 1 }),
    ]);

    expect((await getTask("task-01")).id).toBe("task-01");
    expect(await listFaults()).toHaveLength(3);

    expect(await callOverHttp()).toStrictEqual({
      status: 503,
      body: {
        error: { code: ErrorCode.SERVER_ERROR, message: expect.any(String) },
      },
    });
    expect(await callOverHttp()).toStrictEqual({
      status: 200,
      body: { error: { code: 50010, message: expect.any(String) } },
    });
    expect(await callOverHttp()).toStrictEqual({
      status: 200,
      body: { unexpected: true },
    });
    expect(await listFaults()).toStrictEqual([]);
  });

  test("有次数的故障每用一次减一，用完删除；一直生效的故障保留", async () => {
    await replaceFaults([
      fault({ operation: "task.list", kind: "unexpected", times: 2 }),
      fault({ operation: "comment.list", kind: "unexpected", times: null }),
    ]);

    await expect(listTasks({})).rejects.toThrow();
    expect((await listFaults())[0].times).toBe(1);
    await expect(listTasks({})).rejects.toThrow();
    expect((await listTasks({})).total).toBe(20);
    await expect(listComments("task-01")).rejects.toThrow();
    await expect(listComments("task-01")).rejects.toThrow();
    expect(await listFaults()).toStrictEqual([
      fault({ operation: "comment.list", kind: "unexpected", times: null }),
    ]);
  });

  test("写操作的故障让 Server Action 背后的写入失败，数据不变", async () => {
    await replaceFaults([
      fault({ operation: "task.rename", kind: "unexpected", times: 1 }),
    ]);
    await expect(renameTask("task-01", { name: "改名失败" })).rejects.toThrow();
    expect((await getTask("task-01")).name).toBe("低多边形狐狸");
  });

  test("重置清除故障和调用记录", async () => {
    await replaceFaults([fault({})]);
    await getTask("task-01");
    await resetDemo();
    expect(await listFaults()).toStrictEqual([]);
    expect(await listCalls()).toStrictEqual([]);
  });

  test("不合法的故障配置按参数错误拒绝", async () => {
    expect(
      (
        await rejection(
          replaceFaults([{ ...fault({}), operation: "task.nope" }]),
        )
      ).param,
    ).toBe("faults");
    expect(
      (
        await rejection(
          replaceFaults([fault({ kind: "httpStatus", status: null })]),
        )
      ).param,
    ).toBe("faults");
    expect((await rejection(replaceFaults([fault({ times: 0 })]))).param).toBe(
      "faults",
    );
  });

  test("延迟期间赶上重置的写操作返回 503，不改动重置后的数据；读操作照常返回", async () => {
    await setDefaultLatency(300);
    const write = renameTask("task-01", { name: "重置前的改名" }).then(
      () => null,
      (error: unknown) => error,
    );
    const read = getTask("task-02");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await resetDemo({ paused: true });

    const error = await write;
    expect(error).toBeInstanceOf(DomainError);
    expect(error instanceof DomainError && error.status).toBe(503);
    expect((await read).id).toBe("task-02");
    await setDefaultLatency(0);
    expect((await getTask("task-01")).name).toBe("低多边形狐狸");
  });

  test("调用记录按顺序记下每次业务调用的操作名和来源", async () => {
    await getTask("task-01");
    await callOverHttp();
    await listTasks({});

    expect(
      (await listCalls()).map(({ operation, source }) => [operation, source]),
    ).toStrictEqual([
      ["task.get", "server"],
      ["task.get", "http"],
      ["task.list", "server"],
    ]);
    expect(await listCalls("task.list")).toHaveLength(1);
  });

  test("重置时不传 paused 就保持时钟当前的暂停状态", async () => {
    await setClockPaused(false);
    await resetDemo();
    await advanceActiveTasks();
    expect((await getTask("task-11")).status).toBe("running");

    await resetDemo({ paused: true });
    await resetDemo();
    await advanceActiveTasks();
    expect((await getTask("task-11")).status).toBe("pending");
  });
});

describe("Demo 后端没有启用时", () => {
  test("Route Handler 一律返回 404", async () => {
    const url = process.env.DEMO_DATABASE_URL;
    delete process.env.DEMO_DATABASE_URL;
    try {
      const response = await getTaskOverHttp(
        new Request("http://localhost/api/demo/tasks/task-01"),
        {},
      );
      expect(response.status).toBe(404);
    } finally {
      process.env.DEMO_DATABASE_URL = url;
    }
  });
});
