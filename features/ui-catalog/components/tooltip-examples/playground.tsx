import { IconDownload } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  TooltipPopup,
  TooltipPortal,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TooltipConfig {
  side: "top" | "bottom" | "left" | "right";
  text: string;
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: TooltipConfig = (/* @example-config */ {
  "side": "top",
  "text": "下载 GLB 模型"
} /* @end-example-config */);

/** 不传参数时使用初始配置；UI catalog 页面传入面板里的配置。触发器的 aria-label 和提示文字一致。 */
export function TooltipPlayground({
  config = initialConfig,
}: { config?: TooltipConfig } = {}) {
  return (
    <div className="flex justify-center py-6">
      <TooltipRoot>
        <TooltipTrigger
          render={
            <Button variant="outline" size="icon-md" aria-label={config.text} />
          }
        >
          <IconDownload aria-hidden />
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipPositioner side={config.side}>
            <TooltipPopup>{config.text}</TooltipPopup>
          </TooltipPositioner>
        </TooltipPortal>
      </TooltipRoot>
    </div>
  );
}
