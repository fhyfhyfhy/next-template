"use client";

import { useId } from "react";

import { labelVariants } from "@/components/ui/field";
import {
  RadioGroup,
  RadioIndicator,
  RadioRoot,
} from "@/components/ui/radio-group";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/**
 * RadioGroup 持有选中项，这里由 defaultValue 交给它自己；里面每个 RadioRoot 是一个选项，由包住它的 label 命名，
 * RadioIndicator 是它的圆点。组名用 aria-labelledby 指向可见的标题。
 */
export function Example() {
  const labelId = useId();
  return (
    <div className="space-y-2">
      <div id={labelId} className={labelVariants()}>
        完成提醒
      </div>
      <RadioGroup aria-labelledby={labelId} defaultValue="always">
        <label className="flex items-center gap-2 text-sm">
          <RadioRoot value="always">
            <RadioIndicator />
          </RadioRoot>
          每个任务完成时
        </label>
        <label className="flex items-center gap-2 text-sm">
          <RadioRoot value="failed">
            <RadioIndicator />
          </RadioRoot>
          只在失败时
        </label>
        <label className="flex items-center gap-2 text-sm">
          <RadioRoot value="never">
            <RadioIndicator />
          </RadioRoot>
          不提醒
        </label>
      </RadioGroup>
    </div>
  );
}
