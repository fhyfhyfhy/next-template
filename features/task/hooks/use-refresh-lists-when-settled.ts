"use client";

import { useEffect, useRef } from "react";

import { useQueryClient } from "@/lib/react-query";

import { isTaskActive } from "../api/get-task";
import { taskListKey } from "../api/get-tasks";
import type { TaskStatus } from "../types/task-filters";

/**
 * 任务从进行中变成终态时刷新浏览器里的任务列表：header 的进行中任务数、作品广场等列表不必等自己的轮询。
 * 只在这一次状态变化时触发，页面停留在终态任务上不会反复 invalidate。
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
