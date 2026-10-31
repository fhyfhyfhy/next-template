import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** 尺寸和形状由调用方给出，尽量和加载完成后的内容一致，避免布局跳动。 */
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
