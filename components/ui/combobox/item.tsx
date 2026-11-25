"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { use } from "react";

import { cn } from "@/lib/cn";

import { ComboboxSizeContext } from "./context";
import { comboboxItemVariants } from "./variants";

/** 一个选项；value 是 ComboboxRoot 的 items 里的一项。 */
export function ComboboxItem({
  className,
  ...props
}: ComboboxPrimitive.Item.Props) {
  const size = use(ComboboxSizeContext);
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      data-size={size}
      className={cn(comboboxItemVariants({ size }), className)}
      {...props}
    />
  );
}
