"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { use } from "react";

import { cn } from "@/lib/cn";

import { SelectSizeContext } from "./context";
import { selectItemVariants } from "./variants";

/**
 * An option of the select; its value matches the data in SelectRoot's items.
 */
export function SelectItem({
  className,
  ...props
}: SelectPrimitive.Item.Props) {
  const size = use(SelectSizeContext);
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      data-size={size}
      className={cn(selectItemVariants({ size }), className)}
      {...props}
    />
  );
}
