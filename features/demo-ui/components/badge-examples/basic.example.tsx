import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** 用 variant 区分状态的轻重。 */
export function Example() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge>生成中</Badge>
      <Badge variant="secondary">已完成</Badge>
      <Badge variant="outline">排队中</Badge>
      <Badge variant="destructive">失败</Badge>
    </div>
  );
}
