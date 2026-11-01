"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { streamTaskLogs } from "../../api/get-task-logs";

type StreamState = "streaming" | "ended" | "failed";

/**
 * The generation log is an append-only SSE stream that belongs to no query: it
 * is read with raw `fetch` under the transport exception and accumulated in the
 * component's own state. Unmounting aborts the connection. The caller changes
 * the key when the task enters or leaves an active state: it remounts to read
 * the full log when the task ends, and subscribes again after a retry.
 */
export function TaskLogs({ taskId }: { taskId: string }) {
  const t = useTranslations("demo-task.taskLogs");
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
      <h2 className="mb-2 text-sm font-medium">{t("title")}</h2>
      <div
        role="log"
        aria-label={t("title")}
        className="max-h-48 overflow-y-auto rounded-panel bg-secondary p-3 font-mono text-xs/5 text-secondary-foreground"
      >
        {lines.length === 0 && state === "streaming" && (
          <p className="opacity-60">{t("waiting")}</p>
        )}
        {lines.map((line, index) => (
          // The log only appends and never reorders, so the index is a stable
          // key.
          <p key={index}>{line}</p>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t(state)}</p>
    </section>
  );
}
