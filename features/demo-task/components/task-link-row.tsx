import { Link } from "@/lib/i18n-navigation";

import type { Task } from "../api/get-task";
import { taskDetailHref } from "../utils/task-urls";
import { TaskStatusBadge } from "./task-status-badge";

interface TaskLinkRowProps {
  task: Pick<Task, "id" | "name" | "status">;
}

/** 紧凑列表里的一行任务：名称链接到详情，右侧是状态。调用方提供外层的 `<li>`。 */
export function TaskLinkRow({ task }: TaskLinkRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <Link
        href={taskDetailHref(task.id)}
        className="min-w-0 truncate font-medium hover:text-primary"
      >
        {task.name}
      </Link>
      <TaskStatusBadge status={task.status} />
    </div>
  );
}
