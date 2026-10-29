import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { environmentManager, queryOptions } from "@/lib/react-query";

import { taskSchema } from "./get-task";
import { taskListKey } from "./get-tasks";

const searchResultSchema = z.object({ items: z.array(taskSchema) });

const searchTasks = (term: string, signal?: AbortSignal) =>
  fetchApi({
    url: "/demo/tasks/search",
    params: { term },
    schema: searchResultSchema,
    auth: false,
    signal,
  });

export const searchTasksQueryOptions = (term: string) =>
  queryOptions({
    queryKey: [...taskListKey, "search", { term }],
    // 边输入边搜索时旧关键词的请求要中止。signal 只在浏览器传：服务端带 signal 的 fetch 不参与渲染内去重。
    queryFn: async ({ signal }) =>
      (
        await searchTasks(
          term,
          environmentManager.isServer() ? undefined : signal,
        )
      ).items,
  });
