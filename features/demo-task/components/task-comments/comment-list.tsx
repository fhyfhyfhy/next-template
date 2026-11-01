"use client";

import { IconX } from "@tabler/icons-react";
import { useFormatter, useTranslations } from "next-intl";

import { useMutation, useSuspenseQuery } from "@/lib/react-query";

import { deleteCommentMutationOptions } from "../../api/delete-comment";
import { getCommentsQueryOptions } from "../../api/get-comments";
import { DATE_TIME_FORMAT } from "../../constants/date-time";

export function CommentList({ taskId }: { taskId: string }) {
  const t = useTranslations("demo-task.comments");
  const format = useFormatter();
  // The server dehydrated a pending query; this takes its promise, and the
  // enclosing Suspense shows the placeholder until it resolves.
  const { data: comments } = useSuspenseQuery(getCommentsQueryOptions(taskId));
  const deleteComment = useMutation(deleteCommentMutationOptions(taskId));
  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }
  return (
    <ul aria-label={t("listLabel")} className="space-y-2">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="flex items-start gap-3 rounded-panel border border-border bg-card p-3 text-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="wrap-break-word whitespace-pre-wrap">
              {comment.content}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {comment.sending
                ? t("sending")
                : format.dateTime(comment.createdAt, DATE_TIME_FORMAT)}
            </p>
          </div>
          {!comment.sending && (
            <button
              type="button"
              aria-label={t("delete")}
              className="rounded-control p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => deleteComment.mutate({ commentId: comment.id })}
            >
              <IconX className="size-4" aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
