import Link from "next/link";

import type { TaskStatus } from "../types/task-filters";
import { taskDetailHref } from "../utils/task-urls";
import { TaskStatusBadge } from "./task-status-badge";

interface TaskLinkRowProps {
  taskId: string;
  name: string;
  status: TaskStatus;
}

/** 紧凑列表里的一行任务：名称链接到详情，右侧是状态。调用方提供外层的 `<li>`。 */
export function TaskLinkRow({ taskId, name, status }: TaskLinkRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <Link
        href={taskDetailHref(taskId)}
        className="min-w-0 truncate font-medium hover:text-primary"
      >
        {name}
      </Link>
      <TaskStatusBadge status={status} />
    </div>
  );
}
