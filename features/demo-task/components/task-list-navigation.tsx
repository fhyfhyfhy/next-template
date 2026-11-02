"use client";

import {
  createContext,
  type ReactNode,
  startTransition,
  use,
  useOptimistic,
} from "react";

import { useRouter } from "@/lib/i18n/navigation";

import { taskListHref, type TaskListParams } from "../utils/task-urls";

interface TaskListNavigationValue {
  pendingParams: TaskListParams | null;
  navigate: (params: TaskListParams) => void;
}

const TaskListNavigationContext = createContext<TaskListNavigationValue | null>(
  null,
);

/**
 * 全部任务页工具栏和列表共享的导航状态，包住两者所在的 Suspense。
 * 换筛选要等服务端返回新列表，这期间 URL 和服务端给的 params 还是旧的；导航用 `useOptimistic`
 * 记下目标 params，让选择立即显示，导航完成时 transition 结束，自动回到服务端的值。
 */
export function TaskListNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pendingParams, setPendingParams] =
    useOptimistic<TaskListParams | null>(null);

  function navigate(params: TaskListParams) {
    // router.push 的 transition 在这里发起，和这个 transition 一起结束，目标 params 保留到新页面提交。
    // 用 push：Back 可以撤销每次选择。
    startTransition(() => {
      setPendingParams(params);
      router.push(taskListHref(params));
    });
  }

  return (
    <TaskListNavigationContext value={{ pendingParams, navigate }}>
      {children}
    </TaskListNavigationContext>
  );
}

/**
 * 读全部任务页的导航状态。`params` 是这一次服务端渲染给的值；
 * 返回的 `selected` 在导航进行中是目标 params，否则就是 `params`。
 */
export function useTaskListNavigation(params: TaskListParams) {
  const context = use(TaskListNavigationContext);
  if (!context) {
    throw new Error(
      "useTaskListNavigation must be used inside <TaskListNavigation>",
    );
  }
  return {
    selected: context.pendingParams ?? params,
    pending: context.pendingParams !== null,
    navigate: context.navigate,
  };
}
