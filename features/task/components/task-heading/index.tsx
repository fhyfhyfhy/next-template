"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations();
  const [renaming, setRenaming] = useState(false);
  // 表单卸载时焦点会掉回 body：从表单回来时，「重命名」按钮挂载就取得焦点；页面首次渲染时不抢焦点。
  const [returnFocus, setReturnFocus] = useState(false);
  if (renaming) {
    return (
      <RenameTaskForm
        task={task}
        onDone={() => {
          setRenaming(false);
          setReturnFocus(true);
        }}
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-4xl font-medium tracking-[-0.04em]">{task.name}</h1>
      <LiveTaskStatus taskId={task.id} />
      {editable && (
        <Button
          variant="ghost"
          size="sm"
          autoFocus={returnFocus}
          onClick={() => setRenaming(true)}
        >
          {t("task.taskHeading.rename")}
        </Button>
      )}
    </div>
  );
}
