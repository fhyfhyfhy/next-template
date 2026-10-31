"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useMutation } from "@/lib/react-query";

import { type Task, taskNameSchema } from "../../api/get-task";
import { updateTaskMutationOptions } from "../../api/update-task";
import { TASK_NAME_TAKEN } from "../../constants/error-codes";
import { isTaskActionError } from "../../utils/task-action-error";

const renameSchema = z.object({ name: taskNameSchema });

interface RenameTaskFormProps {
  task: Task;
  onDone: () => void;
}

/** 编辑中的名称是一份草稿：从当前数据开始，保存时走写入，取消就丢弃。 */
export function RenameTaskForm({ task, onDone }: RenameTaskFormProps) {
  const rename = useMutation(updateTaskMutationOptions());
  const form = useForm({
    defaultValues: { name: task.name },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: renameSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        await rename.mutateAsync({
          taskId: task.id,
          name: renameSchema.parse(value).name,
        });
        onDone();
      } catch (error) {
        // 撞名的提示文案来自 Server Action 返回的消息；其他失败已由全局错误处理提示。
        if (isTaskActionError(error, TASK_NAME_TAKEN)) {
          formApi.setErrorMap({
            onSubmit: { fields: { name: [{ message: error.message }] } },
          });
        }
      }
    },
  });
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
      <form.Field name="name">
        {(field) => (
          <FieldRoot
            name={field.name}
            invalid={!field.state.meta.isValid}
            dirty={field.state.meta.isDirty}
            touched={field.state.meta.isTouched}
            className="min-w-60 flex-1"
          >
            <FieldLabel className="sr-only">新名称</FieldLabel>
            <Input
              autoFocus
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value)}
              onBlur={field.handleBlur}
            />
            <FieldError match={!field.state.meta.isValid}>
              {field.state.meta.errors[0]?.message}
            </FieldError>
          </FieldRoot>
        )}
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
