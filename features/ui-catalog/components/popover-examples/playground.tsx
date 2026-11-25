import { Button } from "@/components/ui/button";
import {
  PopoverDescription,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface PopoverConfig {
  side: "top" | "bottom" | "left" | "right";
  align: "start" | "center" | "end";
  triggerLabel: string;
  title: string;
  description: string;
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: PopoverConfig = (/* @example-config */ {
  "side": "bottom",
  "align": "center",
  "triggerLabel": "生成参数",
  "title": "生成参数",
  "description": "这些参数在创建任务时确定，之后不能修改。"
} /* @end-example-config */);

/** 不传参数时使用初始配置；UI catalog 页面传入面板里的配置。 */
export function PopoverPlayground({
  config = initialConfig,
}: { config?: PopoverConfig } = {}) {
  return (
    <div className="flex justify-center py-6">
      <PopoverRoot>
        <PopoverTrigger render={<Button variant="outline" />}>
          {config.triggerLabel}
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverPositioner side={config.side} align={config.align}>
            <PopoverPopup>
              <PopoverTitle>{config.title}</PopoverTitle>
              <PopoverDescription>{config.description}</PopoverDescription>
            </PopoverPopup>
          </PopoverPositioner>
        </PopoverPortal>
      </PopoverRoot>
    </div>
  );
}
