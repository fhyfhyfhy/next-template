"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { use } from "react";

import { cn } from "@/lib/cn";

import { ComboboxSizeContext } from "./context";
import { comboboxNoteVariants } from "./variants";

/** 没有匹配的选项时弹层里的话。Base UI 一直挂着它的元素以便播报，只在这时渲染 children，有选项时不占位置。 */
export function ComboboxEmpty({
  className,
  ...props
}: ComboboxPrimitive.Empty.Props) {
  const size = use(ComboboxSizeContext);
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(comboboxNoteVariants({ size }), className)}
      {...props}
    />
  );
}
