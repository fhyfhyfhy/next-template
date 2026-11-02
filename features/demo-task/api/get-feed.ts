import { fetchApi } from "@/lib/fetch";
import { infiniteQueryOptions } from "@/lib/react-query";

import { feedPageSchema } from "../types/task";
import { taskListKey } from "./get-tasks";

export const FEED_PAGE_SIZE = 6;
/** 第一页没有游标，pageParam 用空字符串表示。 */
export const FIRST_FEED_PAGE = "";

const getFeedPage = (cursor: string) =>
  fetchApi({
    url: "/api/demo/feed",
    params: { cursor: cursor || undefined, limit: FEED_PAGE_SIZE },
    schema: feedPageSchema,
  });

/**
 * 作品广场只包含 done 的任务，游标分页：下一页取排在上一页最后一条之后的任务，滚动期间有任务完成也不会重复。
 * 挂在任务列表前缀下，任务写入后 invalidate 列表时一起刷新。
 */
export const getFeedInfiniteQueryOptions = () =>
  infiniteQueryOptions({
    queryKey: [...taskListKey, "infinite", { status: "done" }],
    queryFn: ({ pageParam }) => getFeedPage(pageParam),
    initialPageParam: FIRST_FEED_PAGE,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
