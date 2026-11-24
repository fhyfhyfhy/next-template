"use client";

import { use } from "react";

import { NavigationTransitionContext } from "./context";

/** 外层 NavigationTransition 的 transition：控件把其中的 `startTransition` 传给负责导航的 nuqs setter。 */
export function useNavigationTransition() {
  const context = use(NavigationTransitionContext);
  if (!context) {
    throw new Error("A navigation must be inside <NavigationTransition>");
  }
  return context;
}
