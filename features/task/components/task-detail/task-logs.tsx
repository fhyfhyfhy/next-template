"use client";

import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";

import { streamTaskLogs } from "../../api/get-task-logs";
import type { TaskStatus } from "../../types/task-filters";

type StreamState = "streaming" | "ended" | "failed";

/**
 * 生成日志是 SSE 推送的追加流，不属于任何 query：按传输例外用 raw `fetch` 读取，累积在组件自己的 state 里。
 * 卸载时中止连接。`active` 变化时清空日志、重新订阅：任务结束时读一遍完整日志，重试后订阅新一轮的日志。
 */
export function TaskLogs({
  taskId,
  active,
  onEnd,
}: {
  taskId: string;
  /** 任务在进行中，日志还会追加。 */
  active: boolean;
  /** 推送结束时收到任务的终态。 */
  onEnd: (status: TaskStatus) => void;
}) {
  const t = useTranslations();
  const [lines, setLines] = useState<string[]>([]);
  const [state, setState] = useState<StreamState>("streaming");
  const handleEnd = useEffectEvent(onEnd);
  // 换订阅时在渲染中重置 state，不换 key 重新挂载：可聚焦的日志区一直是同一个元素，聚焦在上面的键盘焦点不会掉到 body。
  const [subscribedActive, setSubscribedActive] = useState(active);
  if (subscribedActive !== active) {
    setSubscribedActive(active);
    setLines([]);
    setState("streaming");
  }

  // active 不在函数体里读，列为依赖是为了它变化时重新订阅。
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of streamTaskLogs(taskId, controller.signal)) {
          // 中止只停住后续的读取，已经读到的事件仍会交出来；它们属于上一轮订阅，不能写进新一轮的 state。
          if (controller.signal.aborted) return;
          if (event.type === "log") {
            setLines((current) => [...current, event.line]);
            continue;
          }
          setState("ended");
          handleEnd(event.status);
        }
      } catch {
        if (!controller.signal.aborted) setState("failed");
      }
    })();
    return () => controller.abort();
  }, [taskId, active]);

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">{t("task.taskLogs.title")}</h2>
      {/* 内容超出 max-h-48 时要滚动：Safari 不把滚动容器放进 Tab 顺序，键盘用户要靠 tabIndex 聚焦它才能滚。 */}
      <div
        role="log"
        aria-label={t("task.taskLogs.title")}
        tabIndex={0}
        className="max-h-48 overflow-y-auto rounded-panel bg-secondary p-3 font-mono text-xs/5 text-secondary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {lines.length === 0 && state === "streaming" && (
          <p className="opacity-60">{t("task.taskLogs.waiting")}</p>
        )}
        {lines.map((line, index) => (
          // 日志只追加不重排，下标就是稳定的 key。
          <p key={index}>{line}</p>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(`task.taskLogs.${state}`)}
      </p>
    </section>
  );
}
