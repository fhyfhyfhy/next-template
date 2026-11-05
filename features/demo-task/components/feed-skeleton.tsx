import { Skeleton } from "@/components/ui/skeleton";

import { FEED_PAGE_SIZE } from "../constants/feed";

/** 作品广场第一页的占位：卡片的封面、名称和收藏按钮一行，以及列表末尾触发加载下一页的区域。 */
export function FeedSkeleton() {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: FEED_PAGE_SIZE }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-panel border border-border bg-card"
          >
            <Skeleton className="aspect-4/3 w-full rounded-none" />
            <div className="flex items-center gap-2 p-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto size-7" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-12" />
    </div>
  );
}
