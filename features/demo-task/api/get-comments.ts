import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

export const taskCommentSchema = z
  .object({
    id: z.string(),
    task_id: z.string(),
    content: z.string(),
    created_at: z.number(),
  })
  .transform(({ task_id, created_at, ...comment }) => ({
    ...comment,
    taskId: task_id,
    createdAt: created_at,
  }));
export type TaskComment = z.infer<typeof taskCommentSchema>;

/** 评论区的一项：发表评论时先乐观插入一条 `sending` 的临时评论，请求结束后由 refetch 的结果替换。 */
export interface CommentListItem extends TaskComment {
  sending?: boolean;
}

const commentListSchema = z.object({ items: z.array(taskCommentSchema) });

const getComments = (taskId: string) =>
  fetchApi({
    url: `/demo/tasks/${taskId}/comments`,
    schema: commentListSchema,
    auth: false,
  });

export const getCommentsQueryOptions = (taskId: string) =>
  queryOptions({
    queryKey: ["demo-task", "comment", "list", taskId],
    queryFn: async (): Promise<CommentListItem[]> =>
      (await getComments(taskId)).items,
  });
