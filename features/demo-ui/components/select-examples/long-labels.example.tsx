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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const metadata = {
  title: "长选项与多选文案",
  description: "选中值在有限宽度内省略，下拉选项在窄屏中换行显示完整文案。",
  order: 30,
};

/** 单选和多选都由 Value 约束文案宽度，无需调用方处理截断。 */
export function Example() {
  const id = useId();
  const items = [
    { value: "design", label: "设计系统与跨平台组件规范维护" },
    {
      value: "engineering",
      label: "ComponentLibraryAccessibilityAndInteractionReview",
    },
    { value: "product", label: "产品规划" },
  ];
  return (
    <div className="flex w-full flex-wrap gap-6">
      {[false, true].map((multiple) => {
        const labelId = `${id}-${multiple}`;
        return (
          <div key={labelId} className="w-40 space-y-2">
            <span id={labelId} className="text-sm font-medium">
              {multiple ? "多个领域" : "所属领域"}
            </span>
            <SelectRoot<string, boolean>
              items={items}
              multiple={multiple}
              defaultValue={
                multiple ? ["design", "engineering"] : "engineering"
              }
            >
              <SelectTrigger aria-labelledby={labelId}>
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
        );
      })}
    </div>
  );
}
