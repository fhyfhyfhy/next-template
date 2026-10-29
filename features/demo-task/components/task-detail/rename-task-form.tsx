"use client";

import { useForm } from "@tanstack/react-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@/lib/react-query";

import { type Task, taskNameSchema } from "../../api/get-task";
import { updateTaskMutationOptions } from "../../api/update-task";
import { TASK_NAME_TAKEN } from "../../constants/error-codes";
import { isTaskActionError } from "../../utils/task-action-error";

interface RenameTaskFormProps {
  task: Task;
  onDone: () => void;
}

/** 编辑中的名称是一份草稿：从当前数据开始，保存时走写入，取消就丢弃。 */
export function RenameTaskForm({ task, onDone }: RenameTaskFormProps) {
  const rename = useMutation(updateTaskMutationOptions());
  const form = useForm({
    defaultValues: { name: task.name },
    onSubmit: ({ value }) =>
      rename.mutate(
        { taskId: task.id, name: value.name.trim() },
        { onSuccess: onDone },
      ),
  });
  // 撞名的提示文案来自 Server Action 返回的消息。
  const nameTakenMessage = isTaskActionError(rename.error, TASK_NAME_TAKEN)
    ? rename.error.message
    : undefined;
  return (
    <form
      aria-label="重命名任务"
      noValidate
      className="flex flex-wrap items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="name"
        validators={{ onChange: taskNameSchema }}
        listeners={{ onChange: () => rename.reset() }}
      >
        {(field) => {
          const error = field.state.meta.errors[0]?.message ?? nameTakenMessage;
          return (
            <div className="min-w-60 flex-1 space-y-1">
              <label htmlFor="rename-task" className="sr-only">
                新名称
              </label>
              <Input
                id="rename-task"
                autoFocus
                value={field.state.value}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "rename-task-error" : undefined}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              {error && (
                <p id="rename-task-error" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          );
        }}
      </form.Field>
      <Button type="submit" disabled={rename.isPending}>
        保存
      </Button>
      <Button type="button" variant="ghost" onClick={onDone}>
        取消
      </Button>
    </form>
  );
}
