"use client";

import { useEffect, useRef } from "react";

import { useQueryClient } from "@/lib/react-query";

import { isTaskActive } from "../api/get-task";
import { taskListKey } from "../api/get-tasks";
import type { TaskStatus } from "../types/task-filters";

/**
 * Refreshes the task lists in the browser when a task goes from active to a
 * final state, so lists such as the header's active count and the Gallery don't
 * wait for their own polling. It fires only on that status change, so staying
 * on a finished task doesn't invalidate again and again.
 */
export function useRefreshListsWhenSettled(status: TaskStatus | undefined) {
  const queryClient = useQueryClient();
  const previous = useRef(status);
  useEffect(() => {
    if (isTaskActive(previous.current) && status && !isTaskActive(status)) {
      void queryClient.invalidateQueries({ queryKey: taskListKey });
    }
    previous.current = status;
  }, [queryClient, status]);
}
