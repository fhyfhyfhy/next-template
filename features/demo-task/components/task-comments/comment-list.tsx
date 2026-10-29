"use client";

import { IconX } from "@tabler/icons-react";

import { useMutation, useSuspenseQuery } from "@/lib/react-query";

import { deleteCommentMutationOptions } from "../../api/delete-comment";
import { getCommentsQueryOptions } from "../../api/get-comments";
import { formatDateTime } from "../../utils/format-date-time";

export function CommentList({ taskId }: { taskId: string }) {
  // 服务端 dehydrate 的是 pending 的 query，这里接住它的 promise，未完成时由外层 Suspense 显示占位。
  const { data: comments } = useSuspenseQuery(getCommentsQueryOptions(taskId));
  const deleteComment = useMutation(deleteCommentMutationOptions(taskId));
  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">还没有评论</p>;
  }
  return (
    <ul aria-label="评论" className="space-y-2">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="flex items-start gap-3 rounded-panel border border-border bg-card p-3 text-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="break-words whitespace-pre-wrap">{comment.content}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {comment.sending ? "发送中…" : formatDateTime(comment.createdAt)}
            </p>
          </div>
          {!comment.sending && (
            <button
              type="button"
              aria-label="删除评论"
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
