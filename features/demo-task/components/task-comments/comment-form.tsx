"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  FieldControl,
  FieldError,
  FieldLabel,
  FieldRoot,
} from "@/components/ui/field";
import { useHydrated } from "@/hooks/use-hydrated";
import { useMutation } from "@/lib/react-query";

import {
  COMMENT_MAX_LENGTH,
  createCommentMutationOptions,
} from "../../api/create-comment";
import type { DemoTaskTranslator } from "../../types/translator";

const createCommentSchema = (t: DemoTaskTranslator) =>
  z.object({
    content: z
      .string()
      .trim()
      .min(1, t("validation.commentRequired"))
      .max(
        COMMENT_MAX_LENGTH,
        t("validation.commentTooLong", { max: COMMENT_MAX_LENGTH }),
      ),
  });

/**
 * Clears the input on submit (the factory has already inserted the comment
 * optimistically) and puts the text back on failure, so the user's writing
 * isn't lost.
 */
export function CommentForm({ taskId }: { taskId: string }) {
  // Disabled before hydration, for the same reason as `CreateTaskForm`.
  const hydrated = useHydrated();
  const t = useTranslations("demo-task");
  const commentSchema = useMemo(() => createCommentSchema(t), [t]);
  const createComment = useMutation(createCommentMutationOptions(taskId));
  const form = useForm({
    defaultValues: { content: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: commentSchema },
    onSubmit: ({ value, formApi }) => {
      formApi.reset();
      createComment.mutate(
        { content: value.content },
        { onError: () => formApi.setFieldValue("content", value.content) },
      );
    },
  });
  return (
    <form
      aria-label={t("comments.formLabel")}
      noValidate
      className="mt-3 flex items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="content">
        {(field) => (
          <FieldRoot
            name={field.name}
            disabled={!hydrated}
            invalid={!field.state.meta.isValid}
            dirty={field.state.meta.isDirty}
            touched={field.state.meta.isTouched}
            className="flex-1"
          >
            <FieldLabel className="sr-only">
              {t("comments.inputLabel")}
            </FieldLabel>
            <FieldControl
              render={<textarea rows={2} />}
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value)}
              onBlur={field.handleBlur}
              placeholder={t("comments.placeholder")}
              className="w-full rounded-control border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive"
            />
            <FieldError match={!field.state.meta.isValid}>
              {field.state.meta.errors[0]?.message}
            </FieldError>
          </FieldRoot>
        )}
      </form.Field>
      <Button type="submit" disabled={!hydrated}>
        {t("comments.submit")}
      </Button>
    </form>
  );
}
