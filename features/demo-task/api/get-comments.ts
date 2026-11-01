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

/**
 * An item in the comments: posting first inserts a temporary `sending` comment
 * optimistically, which the refetch replaces once the request settles.
 */
export interface CommentListItem extends TaskComment {
  sending?: boolean;
}

const commentListSchema = z
  .object({ items: z.array(taskCommentSchema) })
  .transform(({ items }) => items);

const getComments = (taskId: string) =>
  fetchApi({
    url: `/demo/tasks/${taskId}/comments`,
    schema: commentListSchema,
    auth: false,
  });

export const getCommentsQueryOptions = (taskId: string) =>
  queryOptions({
    queryKey: ["demo-task", "comment", "list", taskId],
    queryFn: (): Promise<CommentListItem[]> => getComments(taskId),
  });
