"use client";

import { useTranslations } from "next-intl";

import { useQuery } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import { relatedTasksQueryOptions } from "../api/get-tasks";
import { TaskLinkRow } from "./task-link-row";

/**
 * 依赖查询：先从详情 query 里取 prompt，再用它查其他任务；prompt 还没拿到时第二个请求不发。
 * 详情页在服务端拿到任务后就预取它，首屏不用等浏览器再请求一轮。
 */
export function RelatedTasks({ taskId }: { taskId: string }) {
  const t = useTranslations();
  const { data: prompt } = useQuery({
    ...getTaskQueryOptions(taskId),
    select: (task) => task.prompt,
  });
  const related = useQuery({
    ...relatedTasksQueryOptions(taskId, prompt),
    enabled: prompt !== undefined,
  });
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">
        {t("task.relatedTasks.title")}
      </h2>
      {related.data ? (
        related.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("task.relatedTasks.empty")}
          </p>
        ) : (
          <ul aria-label={t("task.relatedTasks.title")} className="space-y-2">
            {related.data.items.map((item) => (
              <li key={item.id}>
                <TaskLinkRow task={item} />
              </li>
            ))}
          </ul>
        )
      ) : related.error ? (
        <p className="text-sm text-destructive">
          {t("task.queryState.loadFailed")}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("task.queryState.loading")}
        </p>
      )}
    </section>
  );
}
