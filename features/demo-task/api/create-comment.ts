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

/**
 * `taskId` only decides which task to write to and which comments query to
 * update; it is fixed for this mutation, so it is a factory argument.
 */
export const createCommentMutationOptions = (taskId: string) => {
  const { queryKey } = getCommentsQueryOptions(taskId);
  return mutationOptions({
    mutationFn: (variables: CreateCommentVariables) =>
      createComment(taskId, variables),
    onMutate: async ({ content }, { client }) => {
      // Cancel any refetch in flight first, so its old data doesn't overwrite
      // the optimistically inserted comment.
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
