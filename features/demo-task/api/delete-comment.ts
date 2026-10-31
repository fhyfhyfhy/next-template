import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { mutationOptions } from "@/lib/react-query";

import { getCommentsQueryOptions } from "./get-comments";

interface DeleteCommentVariables {
  commentId: string;
}

const deleteComment = (taskId: string, { commentId }: DeleteCommentVariables) =>
  fetchApi({
    url: `/demo/tasks/${taskId}/comments/${commentId}`,
    method: "DELETE",
    schema: z.null(),
    auth: false,
  });

export const deleteCommentMutationOptions = (taskId: string) => {
  const { queryKey } = getCommentsQueryOptions(taskId);
  return mutationOptions({
    mutationFn: (variables: DeleteCommentVariables) =>
      deleteComment(taskId, variables),
    onMutate: async ({ commentId }, { client }) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      client.setQueryData(queryKey, (comments = []) =>
        comments.filter((comment) => comment.id !== commentId),
      );
      return { previous };
    },
    onError: (_error, _variables, onMutateResult, { client }) => {
      client.setQueryData(queryKey, onMutateResult?.previous);
    },
    onSettled: (_data, _error, _variables, _onMutateResult, { client }) =>
      client.invalidateQueries({ queryKey }),
  });
};
