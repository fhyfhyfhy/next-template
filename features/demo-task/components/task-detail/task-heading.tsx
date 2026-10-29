"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useQuery } from "@/lib/react-query";

import { getTaskQueryOptions, type Task } from "../../api/get-task";
import { TaskStatusBadge } from "../task-status-badge";
import { RenameTaskForm } from "./rename-task-form";

interface TaskHeadingProps {
  task: Task;
  editable: boolean;
}

export function TaskHeading({ task, editable }: TaskHeadingProps) {
  const [renaming, setRenaming] = useState(false);
  if (renaming) {
    return <RenameTaskForm task={task} onDone={() => setRenaming(false)} />;
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-4xl font-medium tracking-[-0.04em]">{task.name}</h1>
      <LiveTaskStatus taskId={task.id} />
      {editable && (
        <Button variant="ghost" size="sm" onClick={() => setRenaming(true)}>
          重命名
        </Button>
      )}
    </div>
  );
}

/** 用 `select` 只订阅 status：轮询带回的进度变化不会让它重新渲染。 */
function LiveTaskStatus({ taskId }: { taskId: string }) {
  const { data: status } = useQuery({
    ...getTaskQueryOptions(taskId),
    select: (task) => task.status,
  });
  if (!status) return null;
  return (
    <span data-testid="task-status">
      <TaskStatusBadge status={status} />
    </span>
  );
}
