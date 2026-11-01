"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect } from "react";

import { useQuery } from "@/lib/react-query";

import {
  getTaskQueryOptions,
  isTaskActive,
  isTaskNotFound,
} from "../../api/get-task";
import { DATE_TIME_FORMAT } from "../../constants/date-time";
import { useRecentTaskIds } from "../../hooks/use-recent-task-ids";
import { useRefreshListsWhenSettled } from "../../hooks/use-refresh-lists-when-settled";
import { RelatedTasks } from "../related-tasks";
import { TaskComments } from "../task-comments";
import { TaskLogs } from "../task-logs";
import { TaskActions } from "./task-actions";
import { TaskCoverPanel } from "./task-cover-panel";
import { TaskHeading } from "./task-heading";
import { TaskProgress } from "./task-progress";

/**
 * React Query owns the task detail: the task advances on its own while the user
 * stays, so it polls while pending or running. The first paint's data comes
 * from the server prefetch.
 */
export function TaskDetail({ taskId }: { taskId: string }) {
  const t = useTranslations("demo-task");
  const format = useFormatter();
  const task = useQuery(getTaskQueryOptions(taskId));
  const { record } = useRecentTaskIds();
  useRefreshListsWhenSettled(task.data?.status);
  useEffect(() => record(taskId), [record, taskId]);

  // Check data first, so a failed refresh keeps the data. For a 404 the query
  // factory's meta turns off the generic toast, and this shows the task as
  // deleted.
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
              {t("taskDetail.deletedNotice")}
            </p>
          )}
          <TaskHeading task={data} editable={!deleted} />
          {isTaskActive(data.status) && (
            <TaskProgress
              progress={data.status === "running" ? data.progress : null}
            />
          )}
          <dl className="grid gap-3 text-sm sm:grid-cols-[96px_1fr]">
            <dt className="text-muted-foreground">{t("taskDetail.prompt")}</dt>
            <dd>{data.prompt}</dd>
            <dt className="text-muted-foreground">
              {t("taskDetail.createdAt")}
            </dt>
            <dd>{format.dateTime(data.createdAt, DATE_TIME_FORMAT)}</dd>
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
      <p className="text-sm text-destructive">{t("queryState.loadFailed")}</p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">{t("queryState.loading")}</p>
  );
}
