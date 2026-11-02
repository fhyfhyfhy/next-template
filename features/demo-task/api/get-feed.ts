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

/** 作品广场只包含 done 的任务；挂在任务列表前缀下，任务写入后 invalidate 列表时一起刷新。 */
export const getFeedInfiniteQueryOptions = () =>
  infiniteQueryOptions({
    queryKey: [...taskListKey, "infinite", { status: "done" }],
    queryFn: ({ pageParam }) => getFeedPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + 1 : undefined,
  });
