"use client";

import { useTranslations } from "next-intl";

import { useQuery } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import { getTasksQueryOptions } from "../api/get-tasks";
import { TaskLinkRow } from "./task-link-row";

/**
 * A dependent query: take the prompt from the detail query, then find other
 * tasks with it; the second request waits until the prompt arrives. Requested
 * only in the browser, not prefetched on the server.
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
