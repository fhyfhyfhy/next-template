"use client";

import { type ReactNode, useTransition } from "react";

import { NavigationTransitionContext } from "./context";

/**
 * 设置页面 URL 状态的控件和服务端按这个状态渲染的内容共享的导航 transition（.claude/rules/data-flow.md 的
 * URL state），包住两者或它们所在的 Suspense。控件把 useNavigationTransition 的 `startTransition` 传给
 * `shallow: false` 的 setter：nuqs 让新的值立即显示，NavigationBusy 在 transition 结束前把旧内容标记为更新中。
 */
export function NavigationTransition({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  return (
    <NavigationTransitionContext value={{ isPending, startTransition }}>
      {children}
    </NavigationTransitionContext>
  );
}
