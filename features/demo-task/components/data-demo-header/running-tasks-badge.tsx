"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { useQuery } from "@/lib/react-query";

import { activeTasksQueryOptions } from "../../api/get-tasks";
import { RunningTasksBadgeSkeleton } from "./running-tasks-badge-skeleton";

/** 进行中（排队中和生成中）的任务数。轮询间隔由 `activeTasksQueryOptions` 决定。 */
export function RunningTasksBadge() {
  const t = useTranslations("demo-task");
  const { data, error } = useQuery(activeTasksQueryOptions());
  if (data) {
    return (
      <Badge
        variant={data.total > 0 ? "primary" : "muted"}
        aria-label={t("runningTasksBadge.label", { total: data.total })}
      >
        {data.total > 0 && <IconLoader2 className="animate-spin" aria-hidden />}
        {t("runningTasksBadge.text", { total: data.total })}
      </Badge>
    );
  }
  if (error) {
    return <Badge variant="outline">{t("queryState.loadFailed")}</Badge>;
  }
  return <RunningTasksBadgeSkeleton />;
}
