"use client";

import { useEffect, useState } from "react";

import { streamTaskLogs } from "../../api/get-task-logs";

type StreamState = "streaming" | "ended" | "failed";

/**
 * 生成日志是 SSE 推送的追加流，不属于任何 query：按传输例外用 raw `fetch` 读取，累积在组件自己的 state 里。
 * 卸载时中止连接。调用方在任务重新开始（重试）时换 key，重新订阅。
 */
export function TaskLogs({ taskId }: { taskId: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [state, setState] = useState<StreamState>("streaming");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of streamTaskLogs(taskId, controller.signal)) {
          if (event.type === "log")
            setLines((current) => [...current, event.line]);
          else setState("ended");
        }
      } catch {
        if (!controller.signal.aborted) setState("failed");
      }
    })();
    return () => controller.abort();
  }, [taskId]);

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">生成日志</h2>
      <div
        role="log"
        aria-label="生成日志"
        className="max-h-48 overflow-y-auto rounded-panel bg-secondary p-3 font-mono text-xs/5 text-secondary-foreground"
      >
        {lines.length === 0 && state === "streaming" && (
          <p className="opacity-60">等待日志…</p>
        )}
        {lines.map((line, index) => (
          // 日志只追加不重排，下标就是稳定的 key。
          <p key={index}>{line}</p>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {state === "streaming" && "日志推送中"}
        {state === "ended" && "日志已结束"}
        {state === "failed" && "日志连接中断"}
      </p>
    </section>
  );
}
