"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { use } from "react";

import { cn } from "@/lib/cn";

import { SelectSizeContext } from "./context";
import { selectTriggerVariants } from "./variants";

export type SelectTriggerProps = SelectPrimitive.Trigger.Props;

/** 选择器触发器，放在 SelectRoot 中；名称来自同一 Root 里的 SelectLabel，或调用方传的 aria-label。 */
export function SelectTrigger({ className, ...props }: SelectTriggerProps) {
  const size = use(SelectSizeContext);
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(selectTriggerVariants({ size }), className)}
      {...props}
    />
  );
}
