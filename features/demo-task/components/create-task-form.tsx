"use client";

import { mergeForm, useForm, useTransform } from "@tanstack/react-form-nextjs";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  createTaskFormOptions,
  type CreateTaskFormState,
  type CreateTaskInput,
  createTaskInputSchema,
} from "../api/create-task";
import { createTaskAction } from "../api/create-task-action";

/**
 * 创建任务：`<form action>` 提交给 Server Action，JS 接管之前的原生提交也能创建；接管之后 TanStack Form
 * 在浏览器里校验，并把服务端返回的字段错误合并进来。成功后 `createdTaskId` 变化，用 key 重新挂载表单来清空。
 */
export function CreateTaskForm() {
  // 初始状态不用包里的 initialFormState：它的 values 是 undefined，被 mergeForm 合并后会清空表单的值。
  const [state, formAction, isPending] = useActionState(
    createTaskAction,
    undefined,
  );
  const createdTaskId =
    state && "createdTaskId" in state ? state.createdTaskId : undefined;
  return (
    <CreateTaskFields
      key={createdTaskId ?? "draft"}
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
  state: CreateTaskFormState | undefined;
  formAction: (formData: FormData) => void;
  isPending: boolean;
}

function CreateTaskFields({
  state,
  formAction,
  isPending,
}: CreateTaskFieldsProps) {
  const form = useForm({
    ...createTaskFormOptions,
    transform: useTransform(
      (baseForm) =>
        mergeForm(baseForm, state && "errorMap" in state ? state : {}),
      [state],
    ),
  });
  return (
    <form
      action={formAction}
      aria-label="创建任务"
      noValidate
      className="mb-8 grid gap-3 rounded-panel border border-border bg-card p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-start"
      onSubmit={(event) => {
        // 浏览器里校验不通过就拦下原生提交，不发请求；handleSubmit 负责把错误显示出来。
        if (!createTaskInputSchema.safeParse(form.state.values).success) {
          event.preventDefault();
        }
        void form.handleSubmit();
      }}
    >
      {fields.map(({ name, label, placeholder }) => (
        <form.Field key={name} name={name}>
          {(field) => {
            // 浏览器校验的错误和服务端合并进来的字段错误都在 errors 里；服务端的在字段改动后清除。
            const error = field.state.meta.isTouched
              ? field.state.meta.errors[0]?.message
              : undefined;
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
