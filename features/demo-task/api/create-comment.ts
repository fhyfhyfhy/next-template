import { nanoid } from "nanoid";

import { fetchApi } from "@/lib/fetch";
import { mutationOptions } from "@/lib/react-query";

import {
  type CommentListItem,
  getCommentsQueryOptions,
  taskCommentSchema,
} from "./get-comments";

export const COMMENT_MAX_LENGTH = 500;

interface CreateCommentVariables {
  content: string;
}

const createComment = (taskId: string, { content }: CreateCommentVariables) =>
  fetchApi({
    url: `/demo/tasks/${taskId}/comments`,
    method: "POST",
    data: { content },
    schema: taskCommentSchema,
    auth: false,
  });

/** `taskId` 只决定写到哪个任务、更新哪个评论 query，对这个 mutation 固定不变，所以是工厂参数。 */
export const createCommentMutationOptions = (taskId: string) => {
  const { queryKey } = getCommentsQueryOptions(taskId);
  return mutationOptions({
    mutationFn: (variables: CreateCommentVariables) =>
      createComment(taskId, variables),
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
  });
};
