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
 * Navigation state shared by the All tasks page's toolbar and list; it wraps
 * the Suspense they sit in. A new filter waits for the server to return the new
 * list, and meanwhile the URL and the server's params are still the old ones.
 * Navigation records the target params with `useOptimistic` so the choice shows
 * at once; when the navigation completes, the transition ends and it falls back
 * to the server's value.
 */
export function TaskListNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pendingParams, setPendingParams] =
    useOptimistic<TaskListParams | null>(null);

  function navigate(params: TaskListParams) {
    // router.push's transition starts here and ends with this one, so the
    // target params last until the new page commits. push, so Back undoes each
    // choice.
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
 * Reads the All tasks page's navigation state. `params` is what this server
 * render gave; the returned `selected` is the target params while a navigation
 * is pending, and `params` otherwise.
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
