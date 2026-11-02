"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";
import { useMutation } from "@/lib/react-query";

import { createTaskMutationOptions } from "../api/create-task";
import {
  type CreateTaskInput,
  createTaskInputSchema,
} from "../api/create-task-request";
import { TASK_NAME_TAKEN } from "../constants/error-codes";
import { isTaskActionError } from "../utils/task-action-error";

const defaultValues: CreateTaskInput = { name: "", prompt: "" };

// 两个 key 都在 `demo-task` 文案的 `createTask` 下。
const fields = [
  { name: "name", labelKey: "nameLabel", placeholderKey: "namePlaceholder" },
  {
    name: "prompt",
    labelKey: "promptLabel",
    placeholderKey: "promptPlaceholder",
  },
] as const satisfies readonly {
  name: keyof CreateTaskInput;
  labelKey: string;
  placeholderKey: string;
}[];

/**
 * 创建任务：浏览器里校验，通过后经 mutation 调用 Server Action，列表随 action 的响应刷新，成功后清空表单。
 * 名称被占用显示在名称字段下，其他失败由全局错误处理提示。
 */
export function CreateTaskForm() {
  // 表单没有原生提交的目标：hydration 之前提交会退化成 GET 整页刷新，输入的文字也会在 hydration 后被清空，所以先不可用。
  const hydrated = useHydrated();
  const t = useTranslations("demo-task");
  const locale = useLocale();
  const schema = useMemo(() => createTaskInputSchema(t), [t]);
  const createTask = useMutation(createTaskMutationOptions(locale));
  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value, formApi }) => {
      try {
        await createTask.mutateAsync(value);
        formApi.reset();
      } catch (error) {
        if (isTaskActionError(error, TASK_NAME_TAKEN)) {
          // 记在 onSubmit 下：改动后重新校验通过时，TanStack Form 会清掉它。
          formApi.setErrorMap({
            onSubmit: {
              fields: { name: [{ message: t("validation.nameTaken") }] },
            },
          });
        }
      }
    },
  });
  return (
    <form
      aria-label={t("createTask.formLabel")}
      noValidate
      className="mb-8 grid gap-3 rounded-panel border border-border bg-card p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-start"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {fields.map(({ name, labelKey, placeholderKey }) => (
        <form.Field key={name} name={name}>
          {(field) => (
            <FieldRoot
              name={field.name}
              disabled={!hydrated}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <FieldLabel>{t(`createTask.${labelKey}`)}</FieldLabel>
              <Input
                value={field.state.value}
                placeholder={t(`createTask.${placeholderKey}`)}
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
            disabled={!hydrated || isSubmitting}
            className="sm:mt-5"
          >
            {isSubmitting ? t("createTask.submitting") : t("createTask.submit")}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
