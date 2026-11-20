"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { useQuery } from "@/lib/react-query";

import { activeTasksQueryOptions } from "../api/get-tasks";
import { RunningTasksBadgeSkeleton } from "./running-tasks-badge-skeleton";

/**
 * 进行中（排队中和生成中）的任务数。轮询间隔由 `activeTasksQueryOptions` 决定。
 * 屏幕上显示简短的说法，读屏读隐藏的完整说法：徽标是没有角色的 span，挂在它上面的 `aria-label` 读屏不读。
 */
export function RunningTasksBadge() {
  const t = useTranslations();
  const { data, error } = useQuery(activeTasksQueryOptions());
  if (data) {
    return (
      <Badge variant={data.total > 0 ? "primary" : "muted"}>
        {data.total > 0 && <IconLoader2 className="animate-spin" aria-hidden />}
        <span aria-hidden>
          {t("task.runningTasksBadge.text", { total: data.total })}
        </span>
        <span className="sr-only">
          {t("task.runningTasksBadge.label", { total: data.total })}
        </span>
      </Badge>
    );
  }
  if (error) {
    return <Badge variant="outline">{t("task.queryState.loadFailed")}</Badge>;
  }
  return <RunningTasksBadgeSkeleton />;
}
