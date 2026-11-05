import { beforeEach, expect } from "vitest";

import { DomainError } from "@/lib/domain-error";

import { advanceTask } from "./generator";
import { demoRoute } from "./http";
import { resetDemo, setDefaultLatency } from "./lab";
import { streamTaskLogs } from "./task-logs";
import { getTask } from "./tasks";

// *.db.test.ts 共用的准备和断言。

/** 每个测试从种子数据开始，时钟暂停，默认延迟为 0。在测试文件的顶层调用。 */
export function resetDemoBeforeEach() {
  beforeEach(async () => {
    await resetDemo({ paused: true });
    await setDefaultLatency(0);
  });
}

/** 读函数的返回值要符合对外的 schema，并且经过一次 JSON 往返后不变：浏览器 refetch 拿到的就是这个值。 */
export function expectWireSafe<T>(
  schema: { parse: (value: unknown) => T },
  value: T,
) {
  expect(schema.parse(JSON.parse(JSON.stringify(value)))).toStrictEqual(value);
}

export async function rejection(promise: Promise<unknown>) {
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

export async function advance(id: string, steps: number) {
  let task;
  for (let step = 0; step < steps; step += 1) task = await advanceTask(id);
  return task;
}

type LogEvent = { type: "log"; line: string } | { type: "end"; status: string };

/**
 * 读任务日志的 SSE 流，直到读满 `count` 个事件、流结束或 `timeoutMs` 内没有新事件，返回读到的事件。
 * `onEvent` 在每个事件到达后调用，测试在其中推进任务、观察新日志推送过来。
 */
export async function readLogs(
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

/** 像浏览器经 Route Handler 那样调用：同样经过 `demoRoute` 适配层。 */
export const getTaskOverHttp = demoRoute(async () => getTask("task-01"));
