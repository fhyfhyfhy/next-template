import "server-only";

import { isTerminalStatus } from "../utils/task-progress";
import { getTaskDb } from "./connection";
import { ensureDemoSeeded } from "./seed";
import { subscribeTaskChanges } from "./task-events";
import { findTaskRow } from "./tasks";

const encoder = new TextEncoder();

function event(name: string, data: unknown) {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * 任务生成日志的 SSE 流：先推送已有日志，之后每条新日志一个 `log` 事件（`{ line }`），任务到终态时发送 `end`
 * 事件（`{ status }`）并结束；任务被删除时直接结束。任务不存在时抛 404，Route Handler 在开始推送前就能返回。
 * 先订阅变化、再查已有日志，按日志序号只推送没推过的，订阅和查询之间写入的日志不会漏掉也不会重复。
 */
export async function streamTaskLogs(
  taskId: string,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array<ArrayBuffer>>> {
  await ensureDemoSeeded();
  const db = getTaskDb();
  await findTaskRow(db, taskId);

  let lastSeq = 0;
  let flushing: Promise<void> | null = null;
  let again = false;
  let unsubscribe: (() => void) | undefined;
  let closed = false;

  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    async start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // 客户端断开时流已经被取消，不能再关闭。
        }
      };
      // 通知可能连续到达，同一时间只跑一次查询，期间到达的通知合并成下一次。
      const flush = (): Promise<void> => {
        if (flushing) {
          again = true;
          return flushing;
        }
        flushing = (async () => {
          do {
            again = false;
            const logs = await db
              .selectFrom("task_logs")
              .select(["seq", "line"])
              .where("task_id", "=", taskId)
              .where("seq", ">", lastSeq)
              .orderBy("seq")
              .execute();
            for (const log of logs) {
              if (closed) return;
              controller.enqueue(event("log", { line: log.line }));
              lastSeq = log.seq;
            }
            const task = await db
              .selectFrom("tasks")
              .select("status")
              .where("id", "=", taskId)
              .executeTakeFirst();
            if (!task) return close();
            if (isTerminalStatus(task.status)) {
              if (!closed)
                controller.enqueue(event("end", { status: task.status }));
              return close();
            }
          } while (again && !closed);
        })().finally(() => {
          flushing = null;
        });
        return flushing;
      };
      unsubscribe = await subscribeTaskChanges(taskId, () => void flush());
      signal.addEventListener("abort", close, { once: true });
      await flush();
    },
    cancel() {
      closed = true;
      unsubscribe?.();
    },
  });
}
