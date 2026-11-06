"use client";

import { useQueryStates } from "nuqs";

import { taskListSearchParams } from "../../utils/task-list-search-params";
import { useTaskListNavigationContext } from "./use-task-list-navigation-context";

/**
 * 读写全部任务页的 URL 状态。列表由 Server Component 按 URL 读取，所以每次改动都要服务端渲染（`shallow: false`）；
 * 用 push，Back 可以撤销每次选择。导航完成前返回的已经是新的选择。
 */
export function useTaskListSearchParams() {
  const { startTransition } = useTaskListNavigationContext();
  return useQueryStates(taskListSearchParams, {
    shallow: false,
    history: "push",
    startTransition,
  });
}
