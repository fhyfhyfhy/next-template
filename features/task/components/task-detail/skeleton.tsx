import { Skeleton } from "@/components/ui/skeleton";

/** 任务详情的占位，区块和间距与加载后的详情一致：标题、信息、操作、日志、评论，以及右侧的封面和相关任务。 */
export function TaskDetailSkeleton() {
  return (
    <div
      data-testid="task-detail-skeleton"
      className="grid gap-8 lg:grid-cols-[1fr_320px]"
    >
      <div className="min-w-0 space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-control-md w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
      <div className="space-y-8">
        <Skeleton className="aspect-4/3 w-full rounded-panel" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
