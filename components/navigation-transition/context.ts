import { createContext, type TransitionStartFunction } from "react";

export interface NavigationTransitionValue {
  isPending: boolean;
  startTransition: TransitionStartFunction;
}

export const NavigationTransitionContext =
  createContext<NavigationTransitionValue | null>(null);
