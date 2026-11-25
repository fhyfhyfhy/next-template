import { IconDownload } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  TooltipPopup,
  TooltipPortal,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/**
 * 只有图标的按钮用 aria-label 命名，提示把同样的话给用指针的人再说一遍：提示不能替代按钮的名称。
 * 整个应用外面包着一个 TooltipProvider（app/providers.tsx），第一个提示出现后，相邻的立即出现。
 */
export function Example() {
  return (
    <TooltipRoot>
      <TooltipTrigger
        render={
          <Button variant="outline" size="icon-sm" aria-label="下载 GLB 模型" />
        }
      >
        <IconDownload aria-hidden />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipPositioner>
          <TooltipPopup>下载 GLB 模型</TooltipPopup>
        </TooltipPositioner>
      </TooltipPortal>
    </TooltipRoot>
  );
}
