"use client";

import { useTranslations } from "next-intl";

import type { TaskStatus } from "../../types/task-filters";
import { useTaskLogStream } from "./use-task-log-stream";

/** 生成日志区：显示 `useTaskLogStream` 收到的日志和推送状态。 */
export function TaskLogs({
  taskId,
  active,
  onEnd,
}: {
  taskId: string;
  /**
   * 日志还会追加时为 true，由调用方按任务状态决定，比如乐观更新的重试还没确认时仍为 false。
   * 变化时清空日志、重新订阅。
   */
  active: boolean;
  /** 推送结束时收到任务的终态。 */
  onEnd: (status: TaskStatus) => void;
}) {
  const t = useTranslations();
  const { lines, state } = useTaskLogStream(taskId, active, onEnd);

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">{t("task.taskLogs.title")}</h2>
      {/* 内容超出 max-h-48 时要滚动：Safari 不把滚动容器放进 Tab 顺序，键盘用户要靠 tabIndex 聚焦它才能滚。 */}
      <div
        role="log"
        aria-label={t("task.taskLogs.title")}
        tabIndex={0}
        className="max-h-48 overflow-y-auto rounded-panel bg-secondary p-3 font-mono text-xs/5 text-secondary-foreground focus-ring"
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
