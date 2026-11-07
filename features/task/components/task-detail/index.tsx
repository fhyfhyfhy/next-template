"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { DateTime } from "@/components/date-time";
import { useIsMutating, useQuery, useQueryClient } from "@/lib/react-query";

import {
  getTaskQueryOptions,
  isTaskActive,
  isTaskNotFound,
} from "../../api/get-task";
import { retryTaskMutationKey } from "../../api/retry-task";
import { DATE_TIME_FORMAT } from "../../constants/date-time";
import { useRecentTaskIds } from "../../hooks/use-recent-task-ids";
import { useRefreshListsWhenSettled } from "../../hooks/use-refresh-lists-when-settled";
import type { TaskStatus } from "../../types/task-filters";
import { RelatedTasks } from "../related-tasks";
import { TaskComments } from "../task-comments";
import { TaskLogs } from "../task-logs";
import { TaskActions } from "./task-actions";
import { TaskCoverPanel } from "./task-cover-panel";
import { TaskHeading } from "./task-heading";
import { TaskProgress } from "./task-progress";

/** 任务详情由 React Query 负责：任务会在用户停留时自己推进，pending、running 时轮询。首屏数据来自服务端 prefetch。 */
export function TaskDetail({ taskId }: { taskId: string }) {
  const t = useTranslations();
  const task = useQuery(getTaskQueryOptions(taskId));
  const { record } = useRecentTaskIds();
  useRefreshListsWhenSettled(task.data?.status);
  useEffect(() => record(taskId), [record, taskId]);
  // 重试先乐观地显示 pending；服务端清空上一轮日志前就重新订阅，会读到旧日志和 end，所以等重试确认后再换日志的 key。
  const retrying =
    useIsMutating({ mutationKey: retryTaskMutationKey(taskId) }) > 0;
  const queryClient = useQueryClient();
  // 日志和旁边的状态一起显示：推送报告的终态和详情不一致时立即刷新详情，不等下一次轮询。
  const refreshIfSettledElsewhere = (status: TaskStatus) => {
    if (task.data?.status === status) return;
    void queryClient.invalidateQueries({
      queryKey: getTaskQueryOptions(taskId).queryKey,
    });
  };

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
              {t("task.taskDetail.deletedNotice")}
            </p>
          )}
          <TaskHeading task={data} editable={!deleted} />
          {isTaskActive(data.status) && (
            <TaskProgress
              progress={data.status === "running" ? data.progress : null}
            />
          )}
          <dl className="grid gap-3 text-sm sm:grid-cols-[96px_1fr]">
            <dt className="text-muted-foreground">
              {t("task.taskDetail.prompt")}
            </dt>
            <dd>{data.prompt}</dd>
            <dt className="text-muted-foreground">
              {t("task.taskDetail.createdAt")}
            </dt>
            <dd>
              <DateTime value={data.createdAt} format={DATE_TIME_FORMAT} />
            </dd>
          </dl>
          {!deleted && <TaskActions task={data} />}
          <TaskLogs
            key={isTaskActive(data.status) && !retrying ? "active" : "settled"}
            taskId={taskId}
            onEnd={refreshIfSettledElsewhere}
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
      <p className="text-sm text-destructive">
        {t("task.queryState.loadFailed")}
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      {t("task.queryState.loading")}
    </p>
  );
}
