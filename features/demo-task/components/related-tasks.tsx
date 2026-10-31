"use client";

import { useTranslations } from "next-intl";

import { useQuery } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import { getTasksQueryOptions } from "../api/get-tasks";
import { TaskLinkRow } from "./task-link-row";

/**
 * 依赖查询：先从详情 query 里取 prompt，再用它查其他任务；prompt 还没拿到时第二个请求不发。
 * 只在浏览器里请求，不在服务端预取。
 */
export function RelatedTasks({ taskId }: { taskId: string }) {
  const t = useTranslations("demo-task");
  const { data: prompt } = useQuery({
    ...getTaskQueryOptions(taskId),
    select: (task) => task.prompt,
  });
  const related = useQuery({
    ...getTasksQueryOptions({ prompt, excludeId: taskId, pageSize: 5 }),
    enabled: prompt !== undefined,
  });
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">{t("relatedTasks.title")}</h2>
      {related.data ? (
        related.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("relatedTasks.empty")}
          </p>
        ) : (
          <ul aria-label={t("relatedTasks.title")} className="space-y-2">
            {related.data.items.map((item) => (
              <li key={item.id}>
                <TaskLinkRow task={item} />
              </li>
            ))}
          </ul>
        )
      ) : related.error ? (
        <p className="text-sm text-destructive">{t("queryState.loadFailed")}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("queryState.loading")}
        </p>
      )}
    </section>
  );
}
