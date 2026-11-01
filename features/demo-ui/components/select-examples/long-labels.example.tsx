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
  title: "Long options and multiple-selection text",
  description:
    "The selected value is truncated to the width available; on narrow screens the options wrap to show their full text.",
  order: 30,
};

/**
 * Value constrains the text width for single and multiple selection alike, so
 * the caller does not truncate.
 */
export function Example() {
  const id = useId();
  const items = [
    {
      value: "design",
      label: "Design system and cross-platform component guidelines",
    },
    {
      value: "engineering",
      label: "ComponentLibraryAccessibilityAndInteractionReview",
    },
    { value: "product", label: "Product planning" },
  ];
  return (
    <div className="flex w-full flex-wrap gap-6">
      {[false, true].map((multiple) => {
        const labelId = `${id}-${multiple}`;
        return (
          <div key={labelId} className="w-40 space-y-2">
            <span id={labelId} className="text-sm font-medium">
              {multiple ? "Areas" : "Area"}
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
