"use server";

import { z } from "zod";

import { assertDemoBackendEnabled } from "@/lib/demo-backend";

import { createComment } from "../server/comments";
import type { TaskComment } from "../types/task";

const inputSchema = z.object({
  taskId: z.string().min(1),
  content: z.string(),
});

/**
 * 发表评论。评论由 React Query 负责，不涉及服务端缓存，所以不调用 updateTag。内容不合规时数据层抛错，
 * 表单在提交前已经按同样的规则校验过，这里不当作预期失败，走全局提示。
 */
export async function createCommentAction(
  input: z.input<typeof inputSchema>,
): Promise<TaskComment> {
  assertDemoBackendEnabled();
  const { taskId, content } = inputSchema.parse(input);
  return createComment(taskId, { content });
}
