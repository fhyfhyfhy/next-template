"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { use } from "react";

import { cn } from "@/lib/cn";

import { SelectSizeContext } from "./context";
import { selectTriggerVariants } from "./variants";

export type SelectTriggerProps = SelectPrimitive.Trigger.Props;

/** The select's trigger. Place it in SelectRoot and give it a label. */
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
