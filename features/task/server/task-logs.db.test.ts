import { sql } from "kysely";
import { describe, expect, test } from "vitest";

import { createDb } from "@/lib/db";

import { readLogs, rejection, resetBeforeEach } from "./db-test-helpers";
import { advanceTask } from "./generator";
import { streamTaskLogs } from "./task-logs";

resetBeforeEach();

describe("生成日志", () => {
  test("监听连接断开时，正在推送的流以错误结束，不会一直等下去", async () => {
    const controller = new AbortController();
    const stream = await streamTaskLogs("task-03", controller.signal);
    const reader = stream.getReader();
    // 读完已有的 3 条日志，流停在等待新日志的状态。
    for (let read = 0; read < 3; read += 1) await reader.read();

    // 模拟数据库断开这条 LISTEN 连接（比如数据库重启）。
    await sql`select pg_terminate_backend(pid) from pg_stat_activity
      where query = 'listen task_changed' and datname = current_database()`.execute(
      createDb(process.env.DATABASE_URL ?? ""),
    );

    await expect(reader.read()).rejects.toThrow(/subscription/);
    controller.abort();
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
