"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";

import { cn } from "@/lib/cn";

/** 选项文字，占满这一行剩下的宽度，ItemIndicator 因此靠在行尾。 */
export function SelectItemText({
  className,
  ...props
}: SelectPrimitive.ItemText.Props) {
  return (
    <SelectPrimitive.ItemText
      data-slot="select-item-text"
      className={cn("flex-1", className)}
      {...props}
    />
  );
}
