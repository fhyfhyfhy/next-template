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
import { Form } from "@/components/ui/form";
import { useHydrated } from "@/hooks/use-hydrated";
import type { Translator } from "@/lib/i18n/translator";
import { useMutation } from "@/lib/react-query";

import { createCommentMutationOptions } from "../../api/create-comment";
import { COMMENT_MAX_LENGTH } from "../../constants/task-rules";

const createCommentSchema = (t: Translator) =>
  z.object({
    content: z
      .string()
      .trim()
      .min(1, t("demo-task.validation.commentRequired"))
      .max(
        COMMENT_MAX_LENGTH,
        t("demo-task.validation.commentTooLong", { max: COMMENT_MAX_LENGTH }),
      ),
  });

/** 提交时立即清空输入框（工厂已经乐观插入了评论），失败时把内容放回去，不丢用户写的字。 */
export function CommentForm({ taskId }: { taskId: string }) {
  // hydration 之前不可用，原因同 `CreateTaskForm`。
  const hydrated = useHydrated();
  const t = useTranslations();
  const commentSchema = useMemo(() => createCommentSchema(t), [t]);
  const createComment = useMutation(createCommentMutationOptions(t, taskId));
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
    <Form
      aria-label={t("demo-task.comments.formLabel")}
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
              {t("demo-task.comments.inputLabel")}
            </FieldLabel>
            <FieldControl
              render={<textarea rows={2} />}
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value)}
              onBlur={field.handleBlur}
              placeholder={t("demo-task.comments.placeholder")}
              className="w-full rounded-control border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive"
            />
            <FieldError match={!field.state.meta.isValid}>
              {field.state.meta.errors[0]?.message}
            </FieldError>
          </FieldRoot>
        )}
      </form.Field>
      <Button type="submit" disabled={!hydrated}>
        {t("demo-task.comments.submit")}
      </Button>
    </Form>
  );
}
