import { Skeleton } from "@/components/ui/skeleton";

/** 搜索框和状态行的占位，用作搜索页 Suspense 的 fallback。 */
export function TaskSearchSkeleton() {
  return (
    <div className="max-w-2xl">
      <Skeleton className="h-control-md w-full" />
      <div className="mt-4 min-h-6" />
    </div>
  );
}
