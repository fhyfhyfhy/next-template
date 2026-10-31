import { z } from "zod";

import { ApiError, resolveApiUrl } from "@/lib/fetch";

import { taskStatusSchema } from "../types/task-filters";

const logEventSchema = z.object({ line: z.string() });
const endEventSchema = z.object({ status: taskStatusSchema });

export type TaskLogEvent =
  | ({ type: "log" } & z.infer<typeof logEventSchema>)
  | ({ type: "end" } & z.infer<typeof endEventSchema>);

/**
 * 订阅任务的生成日志。SSE 响应按传输例外用 raw `fetch` 读取：先收到已有日志，之后每条新日志一个事件，
 * 任务到终态时收到 `end` 并结束。调用方通过 `signal` 在卸载时中止。
 */
export async function* streamTaskLogs(
  taskId: string,
  signal: AbortSignal,
): AsyncGenerator<TaskLogEvent> {
  const url = `/demo/tasks/${taskId}/logs` as const;
  const response = await fetch(resolveApiUrl(url), { signal });
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
