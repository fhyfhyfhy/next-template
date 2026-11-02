import { IconArrowUpRight } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/lib/i18n/navigation";

export const metadata = {
  title: "渲染为链接",
  description: "用 render 换成链接，保留链接的语义和键盘操作。",
  order: 20,
};

/** Badge 只提供外观，交互由 render 传入的元素负责。 */
export function Example() {
  return (
    <Badge
      variant="outline"
      render={<Link href="/demos/tasks?status=failed" />}
      className="hover:text-foreground"
    >
      查看失败的任务
      <IconArrowUpRight aria-hidden />
    </Badge>
  );
}
