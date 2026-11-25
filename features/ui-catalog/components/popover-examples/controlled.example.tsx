"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export const metadata = {
  title: "调用方持有开关状态",
  description:
    "把 open 和 onOpenChange 一起传给包住触发器和浮层的 PopoverRoot；事情做完时由调用方关上。",
  order: 20,
};

/** 调用方持有开关状态：点触发器、点外面或按 Escape 都经 onOpenChange 请求，保存后由调用方关上。 */
export function Example() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(0);
  return (
    <div className="flex items-center gap-3 text-sm">
      <PopoverRoot open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" />}>
          重命名
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverPositioner>
            <PopoverPopup>
              <PopoverTitle>重命名任务</PopoverTitle>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  setSaved((count) => count + 1);
                  setOpen(false);
                }}
              >
                保存
              </Button>
            </PopoverPopup>
          </PopoverPositioner>
        </PopoverPortal>
      </PopoverRoot>
      <span className="text-muted-foreground">已保存 {saved} 次</span>
    </div>
  );
}
