import { use } from "react";

import { TaskListNavigationContext } from "./context";

export function useTaskListNavigationContext() {
  const context = use(TaskListNavigationContext);
  if (!context) {
    throw new Error("Task list navigation must be inside <TaskListNavigation>");
  }
  return context;
}
