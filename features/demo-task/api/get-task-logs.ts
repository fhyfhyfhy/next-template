import { z } from "zod";

import { ApiError, resolveApiUrl } from "@/lib/fetch";

import { taskStatusSchema } from "../types/task-filters";

const logEventSchema = z.object({ line: z.string() });
const endEventSchema = z.object({ status: taskStatusSchema });

export type TaskLogEvent =
  | ({ type: "log" } & z.infer<typeof logEventSchema>)
  | ({ type: "end" } & z.infer<typeof endEventSchema>);

/**
 * Subscribes to a task's generation log. The SSE response is read with raw
 * `fetch` under the transport exception: first the existing log, then one event
 * per new line, and `end` when the task reaches a final state. The caller
 * aborts through `signal` on unmount.
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
    // SSE events are separated by a blank line.
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
