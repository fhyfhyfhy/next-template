"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { useQuery } from "@/lib/react-query";

import { activeTasksQueryOptions } from "../../api/get-tasks";

// Refresh periodically while tasks are active. The interval is longer than the
// detail page's polling; refetch on focus updates it as soon as the user
// returns to the tab.
const POLL_INTERVAL_MS = 10_000;

/** The number of active tasks, queued and generating. */
export function RunningTasksBadge() {
  const t = useTranslations("demo-task.runningTasksBadge");
  const { data } = useQuery({
    ...activeTasksQueryOptions(),
    refetchInterval: (query) =>
      (query.state.data?.total ?? 0) > 0 ? POLL_INTERVAL_MS : false,
  });
  if (!data) return null;
  return (
    <Badge
      variant={data.total > 0 ? "primary" : "muted"}
      aria-label={t("label", { total: data.total })}
    >
      {data.total > 0 && <IconLoader2 className="animate-spin" aria-hidden />}
      {t("text", { total: data.total })}
    </Badge>
  );
}
