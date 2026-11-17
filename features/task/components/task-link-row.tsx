import type { Task } from "../api/get-task";
import { TaskNameLink } from "./task-name-link";
import { TaskStatusBadge } from "./task-status-badge";

interface TaskLinkRowProps {
  task: Pick<Task, "id" | "name" | "status">;
}

/** 紧凑列表里的一行任务：名称链接到详情，右侧是状态。调用方提供外层的 `<li>`。 */
export function TaskLinkRow({ task }: TaskLinkRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <TaskNameLink task={task} className="min-w-0 truncate font-medium" />
      <TaskStatusBadge status={task.status} />
    </div>
  );
}
