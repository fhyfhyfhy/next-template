"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export const metadata = {
  title: "基本用法",
  description: "根布局渲染一次 Toaster 后，任意客户端代码都可以调用 toast()。",
  order: 10,
};

/** 提示文案说明结果，描述补充下一步需要知道的信息。 */
export function Example() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast.success("邀请已发送", {
          description: "对方接受后会出现在成员列表中。",
        })
      }
    >
      发送邀请
    </Button>
  );
}
