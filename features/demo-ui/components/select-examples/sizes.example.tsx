"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useId } from "react";

import {
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectList,
  SelectPopup,
  SelectPortal,
  SelectPositioner,
  SelectRoot,
  type SelectSize,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const metadata = {
  title: "尺寸",
  description: "在 Root 设置尺寸，触发器与下拉选项保持一致，各实例独立选择。",
  order: 15,
};

/** 每个 Root 管理自己的选择值，尺寸同时作用于触发器和 Portal 内的选项。 */
export function Example() {
  const id = useId();
  const sizes: readonly SelectSize[] = ["sm", "md", "lg"];
  const items = [
    { value: "zh", label: "简体中文" },
    { value: "en", label: "English" },
    { value: "ja", label: "日本語" },
  ];
  return (
    <div className="grid w-full gap-5 sm:grid-cols-3">
      {sizes.map((size) => (
        <div key={size} className="space-y-2">
          <span id={`${id}-${size}`} className="text-sm font-medium">
            {size}
          </span>
          <SelectRoot size={size} items={items} defaultValue="zh">
            <SelectTrigger aria-labelledby={`${id}-${size}`}>
              <SelectValue />
              <SelectIcon>
                <IconChevronDown className="size-4" aria-hidden />
              </SelectIcon>
            </SelectTrigger>
            <SelectPortal>
              <SelectPositioner sideOffset={6} alignItemWithTrigger={false}>
                <SelectPopup>
                  <SelectList>
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
                  </SelectList>
                </SelectPopup>
              </SelectPositioner>
            </SelectPortal>
          </SelectRoot>
        </div>
      ))}
    </div>
  );
}
