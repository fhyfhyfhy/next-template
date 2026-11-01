import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for the task detail, laid out like the loaded detail. */
export function TaskDetailSkeleton() {
  return (
    <div
      data-testid="task-detail-skeleton"
      className="grid gap-8 lg:grid-cols-[1fr_320px]"
    >
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="aspect-4/3 w-full rounded-panel" />
    </div>
  );
}
