import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Basic usage",
  description: "Has every import and the structure it needs; copy it as is.",
  order: 10,
};

/**
 * The caller sets the size and shape, as close to the loaded content as it can,
 * so the layout does not shift.
 */
export function Example() {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-panel border border-border bg-card">
      <Skeleton className="aspect-4/3 w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}
