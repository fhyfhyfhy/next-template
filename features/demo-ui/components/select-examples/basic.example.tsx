"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useId } from "react";

import {
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPopup,
  SelectPortal,
  SelectPositioner,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** items 为 Value 提供显示文案。 */
export function Example() {
  const id = useId();
  const items = [
    { value: "zh", label: "简体中文" },
    { value: "en", label: "English" },
    { value: "ja", label: "日本語" },
  ];
  return (
    <div className="w-full max-w-xs space-y-2">
      <span id={id} className="text-sm font-medium">
        语言
      </span>
      <SelectRoot items={items} defaultValue="zh">
        <SelectTrigger aria-labelledby={id}>
          <SelectValue />
          <SelectIcon>
            <IconChevronDown className="size-4" aria-hidden />
          </SelectIcon>
        </SelectTrigger>
        <SelectPortal>
          <SelectPositioner sideOffset={6} alignItemWithTrigger={false}>
            <SelectPopup>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  <SelectItemText className="flex-1">
                    {item.label}
                  </SelectItemText>
                  <SelectItemIndicator>
                    <IconCheck className="size-4" aria-hidden />
                  </SelectItemIndicator>
                </SelectItem>
              ))}
            </SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </SelectRoot>
    </div>
  );
}
