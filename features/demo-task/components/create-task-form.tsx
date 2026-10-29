"use client";

import { useForm } from "@tanstack/react-form";
import { startTransition, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  createTaskDefaultValues,
  type CreateTaskFormState,
  type CreateTaskInput,
  createTaskInputSchema,
} from "../api/create-task";
import { createTaskAction } from "../api/create-task-action";

/**
 * 创建任务：TanStack Form 在浏览器里校验，`useActionState` 提交给 Server Action。
 * 成功后 `createdTaskId` 变化，用 key 重新挂载表单来清空。
 */
export function CreateTaskForm() {
  const [state, formAction, isPending] = useActionState(createTaskAction, {});
  return (
    <CreateTaskFields
      key={state.createdTaskId ?? "draft"}
      state={state}
      formAction={formAction}
      isPending={isPending}
    />
  );
}

const fields = [
  { name: "name", label: "名称", placeholder: "比如：低多边形小鹿" },
  { name: "prompt", label: "Prompt", placeholder: "描述要生成的模型" },
] as const satisfies readonly {
  name: keyof CreateTaskInput;
  label: string;
  placeholder: string;
}[];

interface CreateTaskFieldsProps {
  state: CreateTaskFormState;
  formAction: (formData: FormData) => void;
  isPending: boolean;
}

function CreateTaskFields({
  state,
  formAction,
  isPending,
}: CreateTaskFieldsProps) {
  const form = useForm({
    defaultValues: createTaskDefaultValues,
    validators: { onChange: createTaskInputSchema },
    onSubmit: ({ value }) => {
      const formData = new FormData();
      formData.set("name", value.name);
      formData.set("prompt", value.prompt);
      startTransition(() => formAction(formData));
    },
  });
  return (
    <form
      aria-label="创建任务"
      noValidate
      className="mb-8 grid gap-3 rounded-panel border border-border bg-card p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-start"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {fields.map(({ name, label, placeholder }) => (
        <form.Field key={name} name={name}>
          {(field) => {
            // 服务端的字段错误只对提交时的值有效，用户改了内容就不再显示。
            const serverError =
              field.state.value === state.values?.[name]
                ? state.fieldErrors?.[name]
                : undefined;
            const clientError = field.state.meta.isTouched
              ? field.state.meta.errors[0]?.message
              : undefined;
            const error = clientError ?? serverError;
            const errorId = `${field.name}-error`;
            return (
              <div className="space-y-1">
                <label
                  htmlFor={field.name}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {label}
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  placeholder={placeholder}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                {error && (
                  <p id={errorId} className="text-xs text-destructive">
                    {error}
                  </p>
                )}
              </div>
            );
          }}
        </form.Field>
      ))}
      <Button type="submit" disabled={isPending} className="sm:mt-5">
        {isPending ? "创建中…" : "创建任务"}
      </Button>
    </form>
  );
}
