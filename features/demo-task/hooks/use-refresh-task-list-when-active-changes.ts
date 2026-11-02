"use client";

import { useEffect, useRef } from "react";

import { useQuery } from "@/lib/react-query";

import { expireTaskListAction } from "../api/expire-task-list-action";
import { isTaskActive, type Task } from "../api/get-task";
import { activeTasksQueryOptions, type TaskPage } from "../api/get-tasks";

// 比 header 徽标的轮询勤：列表里的状态和筛选结果要尽快跟上任务的推进。
const POLL_INTERVAL_MS = 3000;

/**
 * 列表是服务端缓存的快照，任务状态却由后端自己推进，不经过 Next 服务端。这里轮询进行中的任务，
 * 有变化（新增、开始生成、结束）就经 action 让列表缓存失效，action 的响应带回重新读取的当前页。
 * 和 header 徽标共用一个 query，两者在同一次轮询后更新。
 */
export function useRefreshTaskListWhenActiveChanges(items: Task[]) {
  const { data: active } = useQuery({
    ...activeTasksQueryOptions(),
    refetchInterval: (query) =>
      (query.state.data?.total ?? 0) > 0 ? POLL_INTERVAL_MS : false,
  });
  const signature = active && toSignature(active);
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!active || signature === previous.current) return;
    // 第一次拿到结果时快照可能已经过时（缓存过期前一直返回旧条目），和当前页的任务对一遍；之后只看变化。
    const outdated =
      previous.current === undefined ? isSnapshotOutdated(items, active) : true;
    previous.current = signature;
    if (outdated) {
      // 失败时不提示：下一次变化或导航会再读取。
      expireTaskListAction().catch(() => undefined);
    }
  }, [active, signature, items]);
}

function toSignature({ items, total }: TaskPage) {
  return `${total}|${items.map((task) => `${task.id}:${task.status}`).join(",")}`;
}

function isSnapshotOutdated(items: Task[], active: TaskPage) {
  const activeStatus = new Map(
    active.items.map((task) => [task.id, task.status]),
  );
  return items.some((task) => {
    const status = activeStatus.get(task.id);
    if (status) return status !== task.status;
    // 进行中的任务超过一页时，不在这一页里不代表已经结束。
    return isTaskActive(task.status) && !active.hasMore;
  });
}
