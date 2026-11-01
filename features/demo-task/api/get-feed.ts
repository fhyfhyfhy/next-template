import { fetchApi } from "@/lib/fetch";
import { infiniteQueryOptions } from "@/lib/react-query";

import { taskListKey, taskPageSchema } from "./get-tasks";

export const FEED_PAGE_SIZE = 6;

export const getFeedPage = (page: number) =>
  fetchApi({
    url: "/demo/feed",
    params: { page, page_size: FEED_PAGE_SIZE },
    schema: taskPageSchema,
    auth: false,
  });

/**
 * The Gallery holds only done tasks. It sits under the task list prefix, so it
 * refreshes with the lists when a task write invalidates them.
 */
export const getFeedInfiniteQueryOptions = () =>
  infiniteQueryOptions({
    queryKey: [...taskListKey, "infinite", { status: "done" }],
    queryFn: ({ pageParam }) => getFeedPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + 1 : undefined,
  });
