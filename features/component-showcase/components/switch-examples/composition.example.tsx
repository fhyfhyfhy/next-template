"use client";

import { useState } from "react";

import { SwitchRoot, SwitchThumb } from "@/components/ui/switch";

export const metadata = {
  title: "受控状态与滑块定制",
  description: "单独修改 Thumb 样式，外部说明跟随开关状态。",
  order: 20,
};

/** 同一状态同时驱动开关和外部说明。 */
export function Example() {
  const [checked, setChecked] = useState(false);
  return (
    <div className="space-y-4 text-center">
      <label className="flex items-center justify-center gap-3 text-sm">
        <SwitchRoot checked={checked} onCheckedChange={setChecked}>
          <SwitchThumb className="rounded-control" />
        </SwitchRoot>
        专注模式
      </label>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {checked ? "已暂停非必要通知" : "接收所有通知"}
      </p>
    </div>
  );
}
