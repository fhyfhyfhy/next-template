"use client";

import { Suspense } from "react";

import { QueryErrorBoundary } from "../query-error-boundary";
import { CommentForm } from "./comment-form";
import { CommentList } from "./comment-list";

/** 评论只在详情页显示，由 React Query 负责；服务端以 pending 状态 dehydrate，数据到了再流式出现。 */
export function TaskComments({ taskId }: { taskId: string }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium">评论</h2>
      <QueryErrorBoundary title="评论">
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">评论加载中…</p>
          }
        >
          <CommentList taskId={taskId} />
        </Suspense>
      </QueryErrorBoundary>
      <CommentForm taskId={taskId} />
    </section>
  );
}
