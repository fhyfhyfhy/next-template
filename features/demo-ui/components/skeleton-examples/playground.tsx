import { Skeleton } from "@/components/ui/skeleton";

export interface SkeletonConfig {
  lines: number;
  avatar: boolean;
}

// The parentheses keep the end marker inside the expression; the UI demo page
// replaces only the initial JSON between the markers.
// prettier-ignore
export const initialConfig: SkeletonConfig = (/* @example-config */ {
  "lines": 2,
  "avatar": true
} /* @end-example-config */);

/**
 * Without a config it uses initialConfig; the UI demo page passes the panel's
 * config.
 */
export function SkeletonPlayground({
  config = initialConfig,
}: { config?: SkeletonConfig } = {}) {
  return (
    <div className="flex w-full max-w-sm items-center gap-4">
      {config.avatar && <Skeleton className="size-12 shrink-0 rounded-full" />}
      <div className="flex-1 space-y-2">
        {Array.from({ length: config.lines }, (_, index) => (
          <Skeleton
            key={index}
            className={index === config.lines - 1 ? "h-4 w-2/3" : "h-4 w-full"}
          />
        ))}
      </div>
    </div>
  );
}
