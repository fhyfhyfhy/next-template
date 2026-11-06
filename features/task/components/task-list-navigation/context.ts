import { createContext, type TransitionStartFunction } from "react";

export interface TaskListNavigationValue {
  isPending: boolean;
  startTransition: TransitionStartFunction;
}

export const TaskListNavigationContext =
  createContext<TaskListNavigationValue | null>(null);
