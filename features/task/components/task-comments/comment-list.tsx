"use client";

import { IconX } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { DateTime } from "@/components/date-time";
import { Button } from "@/components/ui/button";
import { useMutation, useSuspenseQuery } from "@/lib/react-query";

import { deleteCommentMutationOptions } from "../../api/delete-comment";
import { getCommentsQueryOptions } from "../../api/get-comments";
import { DATE_TIME_FORMAT } from "../../constants/date-time";

export function CommentList({ taskId }: { taskId: string }) {
  const t = useTranslations();
  // 服务端 dehydrate 的是 pending 的 query，这里接住它的 promise，未完成时由外层 Suspense 显示占位。
  const { data: comments } = useSuspenseQuery(getCommentsQueryOptions(taskId));
  const deleteComment = useMutation(deleteCommentMutationOptions(t, taskId));
  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("task.comments.empty")}
      </p>
    );
  }
  return (
    <ul aria-label={t("task.comments.listLabel")} className="space-y-2">
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
              {comment.sending ? (
                t("task.comments.sending")
              ) : (
                <DateTime value={comment.createdAt} format={DATE_TIME_FORMAT} />
              )}
            </p>
          </div>
          {!comment.sending && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("task.comments.delete")}
              className="text-muted-foreground"
              onClick={() => deleteComment.mutate({ commentId: comment.id })}
            >
              <IconX aria-hidden />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
