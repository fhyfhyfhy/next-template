import { Skeleton } from "@/components/ui/skeleton";

import { FEED_PAGE_SIZE } from "../api/get-feed";

export function FeedSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: FEED_PAGE_SIZE }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-panel border border-border bg-card"
        >
          <Skeleton className="aspect-4/3 w-full rounded-none" />
          <div className="p-3">
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
