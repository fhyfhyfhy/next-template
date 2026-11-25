"use client";

import { Button } from "@/components/ui/button";
import {
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerPopup,
  DrawerPortal,
  DrawerRoot,
  DrawerTitle,
  DrawerTrigger,
  DrawerViewport,
} from "@/components/ui/drawer";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** 从右边滑出的面板，由 Root 的 swipeDirection 决定；内容放在 DrawerContent 里，在那里选中文字不会触发滑动。 */
export function Example() {
  return (
    <DrawerRoot swipeDirection="right">
      <DrawerTrigger render={<Button variant="outline" />}>
        编辑详情
      </DrawerTrigger>
      <DrawerPortal>
        <DrawerBackdrop />
        <DrawerViewport>
          <DrawerPopup>
            <DrawerTitle>编辑详情</DrawerTitle>
            <DrawerContent className="flex flex-1 flex-col">
              <DrawerDescription>
                面板打开时，后面的页面仍然看得见。
              </DrawerDescription>
              <div className="mt-auto flex justify-end pt-8">
                <DrawerClose render={<Button />}>关闭</DrawerClose>
              </div>
            </DrawerContent>
          </DrawerPopup>
        </DrawerViewport>
      </DrawerPortal>
    </DrawerRoot>
  );
}
