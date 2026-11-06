"use server";

import { z } from "zod";

import { deleteComment } from "../server/comments";

const inputSchema = z.object({
  taskId: z.string().min(1),
  commentId: z.string().min(1),
});

/** 删除评论。评论由 React Query 负责，不涉及服务端缓存，所以不调用 updateTag。 */
export async function deleteCommentAction(
  input: z.input<typeof inputSchema>,
): Promise<void> {
  const { taskId, commentId } = inputSchema.parse(input);
  await deleteComment(taskId, commentId);
}
