import { mutationOptions } from "@/lib/react-query";

import { deleteCommentAction } from "./delete-comment-action";
import { getCommentsQueryOptions } from "./get-comments";

interface DeleteCommentVariables {
  commentId: string;
}

export const deleteCommentMutationOptions = (taskId: string) => {
  const { queryKey } = getCommentsQueryOptions(taskId);
  return mutationOptions({
    mutationFn: ({ commentId }: DeleteCommentVariables) =>
      deleteCommentAction({ taskId, commentId }),
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
