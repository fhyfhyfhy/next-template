"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useId, useState } from "react";

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
  title: "多选与定位",
  description: "多个选择共享一个值，Positioner 独立控制浮层位置。",
  order: 20,
};

/** 多选值由调用方维护，定位参数直接传给 Positioner。 */
export function Example() {
  const [value, setValue] = useState(["design"]);
  const id = useId();
  const items = [
    { value: "design", label: "设计" },
    { value: "code", label: "代码" },
    { value: "writing", label: "写作" },
  ];
  return (
    <div className="w-full max-w-xs space-y-2">
      <span id={id} className="text-sm font-medium">
        兴趣领域
      </span>
      <SelectRoot multiple items={items} value={value} onValueChange={setValue}>
        <SelectTrigger aria-labelledby={id}>
          <SelectValue placeholder="可选择多个领域" />
          <SelectIcon>
            <IconChevronDown className="size-4" aria-hidden />
          </SelectIcon>
        </SelectTrigger>
        <SelectPortal>
          <SelectPositioner
            side="top"
            sideOffset={8}
            alignItemWithTrigger={false}
          >
            <SelectPopup className="border-primary">
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
      <p className="text-xs text-muted-foreground">
        已选择 {value.length} 个领域
      </p>
    </div>
  );
}
