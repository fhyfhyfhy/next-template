"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useMutation } from "@/lib/react-query";

import { createTaskNameSchema, type Task } from "../../api/get-task";
import { updateTaskMutationOptions } from "../../api/update-task";
import { TASK_NAME_TAKEN } from "../../constants/error-codes";
import { isTaskActionError } from "../../utils/task-action-error";

interface RenameTaskFormProps {
  task: Task;
  onDone: () => void;
}

/**
 * The name being edited is a draft: it starts from the current data, is saved
 * through a write, and is discarded on cancel.
 */
export function RenameTaskForm({ task, onDone }: RenameTaskFormProps) {
  const t = useTranslations("demo-task");
  const locale = useLocale();
  const renameSchema = useMemo(
    () => z.object({ name: createTaskNameSchema(t) }),
    [t],
  );
  const rename = useMutation(updateTaskMutationOptions(locale));
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
        // Only a name clash shows on the field; the global error handling has
        // already reported other failures.
        if (isTaskActionError(error, TASK_NAME_TAKEN)) {
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
      aria-label={t("renameTask.formLabel")}
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
            <FieldLabel className="sr-only">
              {t("renameTask.nameLabel")}
            </FieldLabel>
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
        {t("renameTask.save")}
      </Button>
      <Button type="button" variant="ghost" onClick={onDone}>
        {t("renameTask.cancel")}
      </Button>
    </form>
  );
}
