"use client";

import { useEffect, useRef } from "react";

import { useQuery } from "@/lib/react-query";

import { expireTaskListAction } from "../api/expire-task-list-action";
import { isTaskActive, type Task } from "../api/get-task";
import { activeTasksQueryOptions, type TaskPage } from "../api/get-tasks";

// More frequent than the header badge's polling: the statuses and filter
// results in the list should keep up with the tasks quickly.
const POLL_INTERVAL_MS = 3000;

/**
 * The list is a snapshot from the server cache, but the backend advances task
 * status on its own, without the Next server. This polls the active tasks and,
 * on a change (added, started, finished), expires the list cache through an
 * action whose response brings back the current page read again. It shares a
 * query with the header badge, so both update after the same poll.
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
    // On the first result the snapshot may already be outdated (the cache
    // returns old entries until it expires), so check it against the current
    // page's tasks; after that, look only at changes.
    const outdated =
      previous.current === undefined ? isSnapshotOutdated(items, active) : true;
    previous.current = signature;
    if (outdated) {
      // No toast on failure: the next change or navigation reads again.
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
    // With more active tasks than one page holds, a task missing from this page
    // hasn't necessarily finished.
    return isTaskActive(task.status) && !active.hasMore;
  });
}
