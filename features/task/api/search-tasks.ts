import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import { taskListSchema } from "../types/task";
import { taskListKey } from "./get-tasks";

const searchTasks = async (term: string, signal?: AbortSignal) =>
  (
    await fetchApi({
      url: "/api/tasks/search",
      params: { term },
      schema: taskListSchema,
      signal,
    })
  ).items;

export const searchTasksQueryOptions = (term: string) =>
  queryOptions({
    queryKey: [...taskListKey, "search", { term }],
    // 边输入边搜索时旧关键词的请求要中止。
    queryFn: ({ signal }) => searchTasks(term, signal),
  });
