import { useTranslations } from "next-intl";

import { Badge, type BadgeProps } from "@/components/ui/badge";

import type { TaskStatus } from "../types/task-filters";

const variants: Record<TaskStatus, BadgeProps["variant"]> = {
  pending: "outline",
  running: "primary",
  done: "muted",
  failed: "danger",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const t = useTranslations("demo-task.taskStatus");
  return <Badge variant={variants[status]}>{t(status)}</Badge>;
}
