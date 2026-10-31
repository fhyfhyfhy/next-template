"use client";

import { IconCheck } from "@tabler/icons-react";

import { CheckboxIndicator, CheckboxRoot } from "@/components/ui/checkbox";

export const metadata = {
  title: "图标尺寸",
  description: "md 复选框图标默认 14px；通过 size-4 单独设置为 16px。",
  order: 40,
};

/** Root 的 size 保持不变，图标由调用方单独定制。 */
export function Example() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <label className="flex items-center gap-3 text-sm">
        <CheckboxRoot defaultChecked>
          <CheckboxIndicator>
            <IconCheck aria-hidden />
          </CheckboxIndicator>
        </CheckboxRoot>
        默认 14px
      </label>
      <label className="flex items-center gap-3 text-sm">
        <CheckboxRoot defaultChecked>
          <CheckboxIndicator>
            <IconCheck className="size-4" aria-hidden />
          </CheckboxIndicator>
        </CheckboxRoot>
        自定义 16px
      </label>
    </div>
  );
}
