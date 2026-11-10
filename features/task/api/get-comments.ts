import { queryOptions } from "@/lib/react-query";
import { fetchApi } from "@/lib/request/fetch";

import { type TaskComment, taskCommentListSchema } from "../types/task";

export type { TaskComment } from "../types/task";

/** 评论区的一项：发表评论时先乐观插入一条 `sending` 的临时评论，请求结束后由 refetch 的结果替换。 */
export interface CommentListItem extends TaskComment {
  sending?: boolean;
}

const getComments = async (taskId: string) =>
  (
    await fetchApi({
      url: `/api/tasks/${taskId}/comments`,
      schema: taskCommentListSchema,
    })
  ).items;

/** 服务端 prefetch 时展开这份 options、把 `queryFn` 换成数据层的 `listComments`。 */
export const getCommentsQueryOptions = (taskId: string) =>
  queryOptions({
    queryKey: ["task", "comment", "list", taskId],
    queryFn: (): Promise<CommentListItem[]> => getComments(taskId),
  });
