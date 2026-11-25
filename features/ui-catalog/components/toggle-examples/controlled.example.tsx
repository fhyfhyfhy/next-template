"use client";

import { IconPin } from "@tabler/icons-react";
import { useState } from "react";

import { Toggle } from "@/components/ui/toggle";

export const metadata = {
  title: "调用方持有按下状态",
  description: "把 pressed 和 onPressedChange 一起传，在用到状态的地方读它。",
  order: 20,
};

/** 调用方持有是否按下，并在旁边显示出来。 */
export function Example() {
  const [pinned, setPinned] = useState(false);
  return (
    <div className="flex items-center gap-3 text-sm">
      <Toggle variant="outline" pressed={pinned} onPressedChange={setPinned}>
        <IconPin aria-hidden />
        置顶
      </Toggle>
      <span className="text-muted-foreground">
        {pinned ? "已置顶" : "未置顶"}
      </span>
    </div>
  );
}
