import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { environmentManager, queryOptions } from "@/lib/react-query";

import { taskSchema } from "./get-task";
import { taskListKey } from "./get-tasks";

const searchResultSchema = z
  .object({ items: z.array(taskSchema) })
  .transform(({ items }) => items);

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
    // Searching as you type must abort the old term's request. The signal is
    // passed only in the browser: on the server, a fetch with a signal is left
    // out of per-render dedupe.
    queryFn: ({ signal }) =>
      searchTasks(term, environmentManager.isServer() ? undefined : signal),
  });
