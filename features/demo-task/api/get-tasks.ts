import type { z } from "zod";

import { fetchApi, pageSchema } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import type { TaskFilters } from "../types/task-filters";
import { taskSchema } from "./get-task";

/**
 * The query key prefix of every task-list query; invalidating it refreshes the
 * plain lists, the Gallery and search results.
 */
export const taskListKey = ["demo-task", "task", "list"] as const;

export const taskPageSchema = pageSchema(taskSchema);
export type TaskPage = z.infer<typeof taskPageSchema>;

export const getTasks = ({
  status,
  favorite,
  prompt,
  excludeId,
  sort,
  page,
  pageSize,
}: TaskFilters) =>
  fetchApi({
    url: "/demo/tasks",
    params: {
      status,
      favorite,
      prompt,
      exclude_id: excludeId,
      sort,
      page,
      page_size: pageSize,
    },
    schema: taskPageSchema,
    auth: false,
  });

export const getTasksQueryOptions = (filters: TaskFilters) =>
  queryOptions({
    queryKey: [...taskListKey, filters],
    queryFn: () => getTasks(filters),
  });

/**
 * The "My favorites" sidebar's list, newest first by creation time; an
 * optimistic favorite inserts tasks in the same order
 * (update-task-favorite.ts).
 */
export const favoriteTasksQueryOptions = () =>
  getTasksQueryOptions({ favorite: true, sort: "created_desc", pageSize: 50 });

/**
 * The active tasks: the header badge shows their total, and the All tasks page
 * compares their ids and statuses and reads the list again on a change. Tasks
 * advance on their own and must refresh as soon as the tab regains focus, so
 * this doesn't use the global 60-second staleTime. One page fetches up to the
 * Mock API's limit of 50; beyond that `hasMore` is true and the rest show only
 * in `total`.
 */
export const activeTasksQueryOptions = () =>
  queryOptions({
    ...getTasksQueryOptions({ status: ["pending", "running"], pageSize: 50 }),
    staleTime: 0,
  });
