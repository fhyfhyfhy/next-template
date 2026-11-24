"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { useNavigationTransition } from "./use-navigation-transition";

interface NavigationBusyProps {
  className?: string;
  children: ReactNode;
}

/** 包住导航要替换的内容：新内容到达之前显示的还是旧状态的，标记为更新中并调淡。 */
export function NavigationBusy({ className, children }: NavigationBusyProps) {
  const { isPending } = useNavigationTransition();
  return (
    <div
      aria-busy={isPending}
      className={cn("transition-opacity aria-busy:opacity-60", className)}
    >
      {children}
    </div>
  );
}
