import { Skeleton } from "@/components/ui/skeleton";

export interface SkeletonConfig {
  lines: number;
  avatar: boolean;
}

// 括号将结束标记保留在表达式内；UI demo 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: SkeletonConfig = (/* @example-config */ {
  "lines": 2,
  "avatar": true
} /* @end-example-config */);

/** 不传参数时使用初始配置；UI demo 页面传入面板里的配置。 */
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
