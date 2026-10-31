"use client";

import { IconLoader2 } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { useQuery } from "@/lib/react-query";

import { activeTasksQueryOptions } from "../../api/get-tasks";

// 有进行中的任务时定期刷新；间隔比详情页的轮询长，回到标签页时靠 focus refetch 立即更新。
const POLL_INTERVAL_MS = 10_000;

/** 进行中（排队中和生成中）的任务数。 */
export function RunningTasksBadge() {
  const { data } = useQuery({
    ...activeTasksQueryOptions(),
    refetchInterval: (query) =>
      (query.state.data?.total ?? 0) > 0 ? POLL_INTERVAL_MS : false,
  });
  if (!data) return null;
  return (
    <Badge
      variant={data.total > 0 ? "primary" : "muted"}
      aria-label={`进行中的任务 ${data.total} 个`}
    >
      {data.total > 0 && <IconLoader2 className="animate-spin" aria-hidden />}
      进行中 {data.total}
    </Badge>
  );
}
