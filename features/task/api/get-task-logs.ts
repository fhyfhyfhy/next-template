import { z } from "zod";

import { BASE_PATH } from "@/lib/base-path";
import { ApiError } from "@/lib/request/fetch";

import { taskStatusSchema } from "../types/task-filters";

const logEventSchema = z.object({ line: z.string() });
const endEventSchema = z.object({ status: taskStatusSchema });

export type TaskLogEvent =
  | ({ type: "log" } & z.infer<typeof logEventSchema>)
  | ({ type: "end" } & z.infer<typeof endEventSchema>);

/**
 * 订阅任务的生成日志。SSE 响应按传输例外用 raw `fetch` 读取：先收到已有日志，之后每条新日志一个事件，
 * 任务到终态时收到 `end` 并结束。调用方通过 `signal` 中止订阅；中止只停住之后的读取，已经读到、还没交出的事件
 * 仍会一个个交出来，调用方要自己丢弃。
 */
export async function* streamTaskLogs(
  taskId: string,
  signal: AbortSignal,
): AsyncGenerator<TaskLogEvent> {
  const url = `${BASE_PATH}/api/tasks/${taskId}/logs` as const;
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) {
    throw new ApiError({
      url,
      status: response.status,
      body: await response.text(),
    });
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += value;
    let boundary;
    // SSE 的事件之间用空行分隔。
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = parseEvent(block);
      if (event) yield event;
      if (event?.type === "end") return;
    }
  }
}

function parseEvent(block: string): TaskLogEvent | null {
  const name = /^event: (.+)$/m.exec(block)?.[1];
  const data = /^data: (.+)$/m.exec(block)?.[1];
  if (!data) return null;
  const payload: unknown = JSON.parse(data);
  if (name === "end") return { type: "end", ...endEventSchema.parse(payload) };
  return { type: "log", ...logEventSchema.parse(payload) };
}
