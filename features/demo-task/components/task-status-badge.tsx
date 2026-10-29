import { Badge, type BadgeProps } from "@/components/ui/badge";

import { TASK_STATUS_LABELS } from "../constants/task-list";
import type { TaskStatus } from "../types/task-filters";

const variants: Record<TaskStatus, BadgeProps["variant"]> = {
  pending: "outline",
  running: "default",
  done: "secondary",
  failed: "destructive",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={variants[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}
