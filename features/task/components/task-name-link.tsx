import Link from "next/link";

import { cn } from "@/lib/cn";

import type { Task } from "../api/get-task";
import { taskDetailHref } from "../utils/task-urls";

interface TaskNameLinkProps {
  task: Pick<Task, "id" | "name">;
  /** 只放布局：截断、在行里占多宽，由所在的列表或卡片决定。 */
  className?: string;
}

/** 链接到任务详情的任务名。列表、卡片和面板里的任务名都用它，字重、hover 和 focus 的样式才一致。 */
export function TaskNameLink({ task, className }: TaskNameLinkProps) {
  return (
    <Link
      href={taskDetailHref(task.id)}
      className={cn("font-medium focus-ring hover:text-primary", className)}
    >
      {task.name}
    </Link>
  );
}
