"use client";

import { useMounted } from "@mantine/hooks";
import { revalidateLogic, useForm } from "@tanstack/react-form";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useMutation } from "@/lib/react-query";

import { createTaskMutationOptions } from "../api/create-task";
import {
  type CreateTaskInput,
  createTaskInputSchema,
} from "../api/create-task-request";
import { TASK_NAME_TAKEN } from "../constants/error-codes";
import { isTaskActionError } from "../utils/task-action-error";

const defaultValues: CreateTaskInput = { name: "", prompt: "" };

const fields = [
  { name: "name", label: "名称", placeholder: "比如：低多边形小鹿" },
  { name: "prompt", label: "Prompt", placeholder: "描述要生成的模型" },
] as const satisfies readonly {
  name: keyof CreateTaskInput;
  label: string;
  placeholder: string;
}[];

/**
 * 创建任务：浏览器里校验，通过后经 mutation 调用 Server Action，列表随 action 的响应刷新，成功后清空表单。
 * 名称被占用显示在名称字段下，其他失败由全局错误处理提示。
 */
export function CreateTaskForm() {
  // 表单没有原生提交的目标：JS 接管之前提交会退化成 GET 整页刷新，输入的文字也会在 hydration 后被清空，所以先不可用。
  const mounted = useMounted();
  const createTask = useMutation(createTaskMutationOptions());
  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: createTaskInputSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        await createTask.mutateAsync(value);
        formApi.reset();
      } catch (error) {
        if (isTaskActionError(error, TASK_NAME_TAKEN)) {
          // 记在 onSubmit 下：改动后重新校验通过时，TanStack Form 会清掉它。
          formApi.setErrorMap({
            onSubmit: { fields: { name: [{ message: error.message }] } },
          });
        }
      }
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
          {(field) => (
            <FieldRoot
              name={field.name}
              disabled={!mounted}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <FieldLabel>{label}</FieldLabel>
              <Input
                value={field.state.value}
                placeholder={placeholder}
                onValueChange={(value) => field.handleChange(value)}
                onBlur={field.handleBlur}
              />
              <FieldError match={!field.state.meta.isValid}>
                {field.state.meta.errors[0]?.message}
              </FieldError>
            </FieldRoot>
          )}
        </form.Field>
      ))}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            type="submit"
            disabled={!mounted || isSubmitting}
            className="sm:mt-5"
          >
            {isSubmitting ? "创建中…" : "创建任务"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
