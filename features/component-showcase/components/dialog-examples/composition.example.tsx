"use client";

import { Button } from "@/components/ui/button";
import {
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const metadata = {
  title: "单独定制部件",
  description: "Backdrop 的模糊和 Popup 的边框，在调用方分别设置。",
  order: 20,
};

/** 背景和面板样式分别传入对应部件，不增加包装组件的间接参数。 */
export function Example() {
  return (
    <DialogRoot>
      <DialogTrigger render={<Button variant="outline" />}>
        定制背景与面板
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop className="bg-foreground/60 backdrop-blur-md" />
        <DialogPopup size="sm" className="border-t-4 border-primary">
          <DialogTitle>每个部件，各司其职。</DialogTitle>
          <DialogDescription>
            Backdrop 的颜色与模糊、Popup 的尺寸与边框，都可以直接定制。
          </DialogDescription>
          <div className="mt-6">
            <DialogClose render={<Button className="w-full" />}>
              继续探索
            </DialogClose>
          </div>
        </DialogPopup>
      </DialogPortal>
    </DialogRoot>
  );
}
