import { nanoid } from "nanoid";

import type { Translator } from "@/lib/i18n/translator";
import { mutationOptions } from "@/lib/react-query";

import { createCommentAction } from "./create-comment-action";
import { type CommentListItem, getCommentsQueryOptions } from "./get-comments";

interface CreateCommentVariables {
  content: string;
}

/** `taskId` 只决定写到哪个任务、更新哪个评论 query，对这个 mutation 固定不变，所以是工厂参数。 */
export const createCommentMutationOptions = (t: Translator, taskId: string) => {
  const { queryKey } = getCommentsQueryOptions(taskId);
  return mutationOptions({
    mutationFn: ({ content }: CreateCommentVariables) =>
      createCommentAction({ taskId, content }),
    onMutate: async ({ content }, { client }) => {
      // 先取消进行中的 refetch，免得它带着旧数据覆盖乐观插入的评论。
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      const sending: CommentListItem = {
        id: `sending-${nanoid()}`,
        taskId,
        content: content.trim(),
        createdAt: Date.now(),
        sending: true,
      };
      client.setQueryData(queryKey, (comments = []) => [...comments, sending]);
      return { previous };
    },
    onError: (_error, _variables, onMutateResult, { client }) => {
      client.setQueryData(queryKey, onMutateResult?.previous);
    },
    onSettled: (_data, _error, _variables, _onMutateResult, { client }) =>
      client.invalidateQueries({ queryKey }),
    meta: { errorMessage: t("task.comments.createFailed") },
  });
};
