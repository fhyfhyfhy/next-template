import { Skeleton } from "@/components/ui/skeleton";

/** 和徽标同样大小的占位，用作加载中的状态和服务端预取时的 Suspense fallback。 */
export function RunningTasksBadgeSkeleton() {
  return <Skeleton className="h-5.5 w-20 rounded-full" />;
}
