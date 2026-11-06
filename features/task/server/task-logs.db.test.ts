import { sql } from "kysely";
import { describe, expect, test } from "vitest";

import { getDb } from "@/lib/db";

import { readLogs, rejection, resetBeforeEach } from "./db-test-helpers";
import { advanceTask } from "./generator";
import { streamTaskLogs } from "./task-logs";

resetBeforeEach();

/**
 * 打开 task-03 的日志流、读完已有的 3 条，再模拟数据库断开 LISTEN 连接（比如数据库重启），
 * 等这条流以错误结束：这时连接已经作废。
 */
async function dropListenConnection() {
  const controller = new AbortController();
  const stream = await streamTaskLogs("task-03", controller.signal);
  const reader = stream.getReader();
  for (let read = 0; read < 3; read += 1) await reader.read();

  await sql`select pg_terminate_backend(pid) from pg_stat_activity
    where query = 'listen task_changed' and datname = current_database()`.execute(
    getDb(),
  );

  const ended = await reader.read().then(
    () => null,
    (error: unknown) => error,
  );
  controller.abort();
  return ended;
}

describe("生成日志", () => {
  test("监听连接断开时，正在推送的流以错误结束，不会一直等下去", async () => {
    expect(await dropListenConnection()).toMatchObject({
      message: expect.stringMatching(/subscription/),
    });
  });

  test("监听连接断开后，之后打开的流重新连接，照常推送新日志", async () => {
    await dropListenConnection();

    const events = await readLogs("task-03", 10, {
      timeoutMs: 2000,
      onEvent: async (index) => {
        if (index >= 3) await advanceTask("task-03");
      },
    });

    expect(events.at(-1)).toStrictEqual({ type: "end", status: "done" });
  });

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
