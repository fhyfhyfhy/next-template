"use client";

import type { ReactNode } from "react";

import { useTaskListNavigationContext } from "./use-task-list-navigation-context";

/** 包住列表：导航期间显示的还是旧列表，标记为更新中并调淡。 */
export function TaskListBusy({ children }: { children: ReactNode }) {
  const { isPending } = useTaskListNavigationContext();
  return (
    <div
      aria-busy={isPending}
      className="transition-opacity aria-busy:opacity-60"
    >
      {children}
    </div>
  );
}
