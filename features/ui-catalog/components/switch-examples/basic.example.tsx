"use client";

import { SwitchRoot, SwitchThumb } from "@/components/ui/switch";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** 调用方显式组合 Root 与 Thumb。 */
export function Example() {
  return (
    <label className="flex items-center gap-3 text-sm">
      <SwitchRoot defaultChecked>
        <SwitchThumb />
      </SwitchRoot>
      开启通知
    </label>
  );
}
