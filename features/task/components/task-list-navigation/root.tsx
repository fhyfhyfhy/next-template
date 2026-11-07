"use client";

import { type ReactNode, useTransition } from "react";

import { TaskListNavigationContext } from "./context";

/**
 * 全部任务页工具栏和列表共享的导航 transition，包住两者所在的 Suspense。
 * 换筛选、排序、分页要等服务端返回新列表：nuqs 让新的选择立即显示，旧列表在 transition 结束前标记为更新中。
 */
export function TaskListNavigation({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  return (
    <TaskListNavigationContext value={{ isPending, startTransition }}>
      {children}
    </TaskListNavigationContext>
  );
}
