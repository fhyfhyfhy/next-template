"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { Task } from "../../api/get-task";
import { LiveTaskStatus } from "./live-task-status";
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
