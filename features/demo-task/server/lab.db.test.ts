import { describe, expect, test } from "vitest";

import { DomainError, ErrorCode } from "@/lib/domain-error";

import type { DemoFault } from "../types/demo-fault";
import { listComments } from "./comments";
import {
  getTaskOverHttp,
  rejection,
  resetDemoBeforeEach,
} from "./db-test-helpers";
import { advanceActiveTasks } from "./generator";
import {
  getDefaultLatency,
  listCalls,
  listFaults,
  replaceFaults,
  resetDemo,
  setClockPaused,
  setDefaultLatency,
} from "./lab";
import { getTask, listTasks, renameTask } from "./tasks";

resetDemoBeforeEach();

const fault = (overrides: Partial<DemoFault>): DemoFault => ({
  operation: "task.get",
  kind: "latency",
  latencyMs: 0,
  code: null,
  status: null,
  times: null,
  ...overrides,
});

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
