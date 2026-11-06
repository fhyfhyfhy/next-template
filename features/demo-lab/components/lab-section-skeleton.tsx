import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/** 实验区块的占位，供页面给每个区块单独的 Suspense 使用；高度接近区块加载后的高度。 */
export function LabSectionSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-48 rounded-panel", className)} />;
}
