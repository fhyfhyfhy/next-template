"use client";

import { IconCheck } from "@tabler/icons-react";

import { CheckboxIndicator, CheckboxRoot } from "@/components/ui/checkbox";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** 调用方显式组合 Root 与 Indicator。 */
export function Example() {
  return (
    <label className="flex items-center gap-3 text-sm">
      <CheckboxRoot defaultChecked>
        <CheckboxIndicator>
          <IconCheck aria-hidden />
        </CheckboxIndicator>
      </CheckboxRoot>
      我已阅读使用条款
    </label>
  );
}
