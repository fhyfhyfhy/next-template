import { Button } from "@/components/ui/button";
import {
  PopoverClose,
  PopoverDescription,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/**
 * 点触发器在旁边打开详情，点外面、按 Escape 或点关闭按钮关上。浮层是一个对话框，名称取自 Title，说明取自
 * Description；和提示不同，它靠点击打开，触屏上也能用，里面还可以放控件。
 */
export function Example() {
  return (
    <PopoverRoot>
      <PopoverTrigger render={<Button variant="outline" />}>
        生成参数
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverPositioner>
          <PopoverPopup>
            <PopoverTitle>生成参数</PopoverTitle>
            <p className="mt-1">风格：低多边形 · 面数：5000</p>
            <PopoverDescription>
              创建任务时确定，之后不能修改。
            </PopoverDescription>
            <PopoverClose
              render={<Button variant="ghost" size="sm" className="mt-3" />}
            >
              关闭
            </PopoverClose>
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </PopoverRoot>
  );
}
