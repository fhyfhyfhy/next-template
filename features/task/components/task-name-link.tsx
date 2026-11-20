import Link from "next/link";

import { cn } from "@/lib/cn";

import type { Task } from "../api/get-task";
import { taskDetailHref } from "../utils/task-urls";

interface TaskNameLinkProps {
  task: Pick<Task, "id" | "name">;
  /** 布局：截断、字重、在行里占多宽，由所在的列表或卡片决定。 */
  className?: string;
}

/** 任务名，链接到任务详情。 */
export function TaskNameLink({ task, className }: TaskNameLinkProps) {
  return (
    <Link
      href={taskDetailHref(task.id)}
      className={cn(
        "outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {task.name}
    </Link>
  );
}
