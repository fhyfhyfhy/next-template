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

// Both keys are under `createTask` in the `demo-task` messages.
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
 * Creates a task: validates in the browser, then calls the Server Action
 * through a mutation; the list refreshes with the action's response, and the
 * form clears on success. A taken name shows under the name field; the global
 * error handling reports other failures.
 */
export function CreateTaskForm() {
  // The form has no native submit target: submitting before hydration would
  // fall back to a full-page GET, and hydration would clear what was typed, so
  // it stays disabled until then.
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
          // Set under onSubmit, so TanStack Form clears it once an edit passes
          // validation again.
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
