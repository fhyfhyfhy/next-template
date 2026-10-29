"use client";

import { useEffect } from "react";

import { useQuery } from "@/lib/react-query";

import {
  getTaskQueryOptions,
  isTaskActive,
  isTaskNotFound,
} from "../../api/get-task";
import { useRecentTaskIds } from "../../hooks/use-recent-task-ids";
import { useRefreshListsWhenSettled } from "../../hooks/use-refresh-lists-when-settled";
import { formatDateTime } from "../../utils/format-date-time";
import { RelatedTasks } from "../related-tasks";
import { TaskComments } from "../task-comments";
import { TaskLogs } from "../task-logs";
import { TaskActions } from "./task-actions";
import { TaskCoverPanel } from "./task-cover-panel";
import { TaskHeading } from "./task-heading";
import { TaskProgress } from "./task-progress";

/** 任务详情由 React Query 负责：任务会在用户停留时自己推进，pending、running 时轮询。首屏数据来自服务端 prefetch。 */
export function TaskDetail({ taskId }: { taskId: string }) {
  const task = useQuery(getTaskQueryOptions(taskId));
  const { record } = useRecentTaskIds();
  useRefreshListsWhenSettled(task.data?.status);
  useEffect(() => record(taskId), [record, taskId]);

  // 先看 data：刷新失败时保留已有数据。404 由 query 工厂的 meta 关掉通用提示，这里显示已删除。
  if (task.data) {
    const deleted = isTaskNotFound(task.error);
    const { data } = task;
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          {deleted && (
            <p
              role="alert"
              className="rounded-panel border border-destructive/40 bg-destructive/10 p-4 text-sm"
            >
              任务已被删除，下面是删除前的最后一份数据。
            </p>
          )}
          <TaskHeading task={data} editable={!deleted} />
          {isTaskActive(data.status) && (
            <TaskProgress
              progress={data.status === "running" ? data.progress : null}
            />
          )}
          <dl className="grid gap-3 text-sm sm:grid-cols-[96px_1fr]">
            <dt className="text-muted-foreground">Prompt</dt>
            <dd>{data.prompt}</dd>
            <dt className="text-muted-foreground">创建时间</dt>
            <dd>{formatDateTime(data.createdAt)}</dd>
          </dl>
          {!deleted && <TaskActions task={data} />}
          <TaskLogs
            key={isTaskActive(data.status) ? "active" : "settled"}
            taskId={taskId}
          />
          {!deleted && <TaskComments taskId={taskId} />}
        </div>
        <aside className="space-y-8">
          <TaskCoverPanel task={data} editable={!deleted} />
          <RelatedTasks taskId={taskId} />
        </aside>
      </div>
    );
  }
  if (task.error) {
    return (
      <p className="text-sm text-destructive">加载失败：{task.error.message}</p>
    );
  }
  return <p className="text-sm text-muted-foreground">加载中…</p>;
}
