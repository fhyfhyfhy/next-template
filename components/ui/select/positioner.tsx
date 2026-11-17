"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";

import { cn } from "@/lib/cn";

/**
 * 选项定位层。两个默认值和 Base UI 不同：`sideOffset` 为 6、`alignItemWithTrigger` 为 false，
 * 选项在 trigger 外 6px 处展开，不盖在 trigger 上，也不把选中项对齐 trigger 的文字。其余定位参数沿用 Base UI。
 */
export function SelectPositioner({
  sideOffset = 6,
  alignItemWithTrigger = false,
  className,
  ...props
}: SelectPrimitive.Positioner.Props) {
  return (
    <SelectPrimitive.Positioner
      data-slot="select-positioner"
      sideOffset={sideOffset}
      alignItemWithTrigger={alignItemWithTrigger}
      className={cn("z-50 outline-none", className)}
      {...props}
    />
  );
}
