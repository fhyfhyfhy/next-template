"use client";

import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/lib/react-query";

import {
  COMMENT_MAX_LENGTH,
  createCommentMutationOptions,
} from "../../api/create-comment";

const contentSchema = z
  .string()
  .trim()
  .min(1, "请输入评论")
  .max(COMMENT_MAX_LENGTH, `评论最多 ${COMMENT_MAX_LENGTH} 个字`);

/** 提交时立即清空输入框（工厂已经乐观插入了评论），失败时把内容放回去，不丢用户写的字。 */
export function CommentForm({ taskId }: { taskId: string }) {
  const createComment = useMutation(createCommentMutationOptions(taskId));
  const form = useForm({
    defaultValues: { content: "" },
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
      aria-label="发表评论"
      noValidate
      className="mt-3 flex items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="content" validators={{ onSubmit: contentSchema }}>
        {(field) => {
          const error = field.state.meta.errors[0]?.message;
          return (
            <div className="flex-1 space-y-1">
              <label htmlFor="comment-content" className="sr-only">
                写评论
              </label>
              <textarea
                id="comment-content"
                rows={2}
                value={field.state.value}
                placeholder="写下你的评论"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "comment-content-error" : undefined}
                className="w-full rounded-control border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15 aria-invalid:border-destructive"
                onChange={(event) => field.handleChange(event.target.value)}
              />
              {error && (
                <p
                  id="comment-content-error"
                  className="text-xs text-destructive"
                >
                  {error}
                </p>
              )}
            </div>
          );
        }}
      </form.Field>
      <Button type="submit">发表</Button>
    </form>
  );
}
