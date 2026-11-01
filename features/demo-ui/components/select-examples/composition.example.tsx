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
  title: "Multiple selection and positioning",
  description:
    "The selections share one value; Positioner controls where the popup sits on its own.",
  order: 20,
};

/**
 * The caller holds the selected values and passes the positioning props
 * straight to Positioner.
 */
export function Example() {
  const [value, setValue] = useState(["design"]);
  const id = useId();
  const items = [
    { value: "design", label: "Design" },
    { value: "code", label: "Code" },
    { value: "writing", label: "Writing" },
  ];
  return (
    <div className="w-full max-w-xs space-y-2">
      <span id={id} className="text-sm font-medium">
        Interests
      </span>
      <SelectRoot multiple items={items} value={value} onValueChange={setValue}>
        <SelectTrigger aria-labelledby={id}>
          <SelectValue placeholder="Pick one or more areas" />
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
        {value.length} areas selected
      </p>
    </div>
  );
}
