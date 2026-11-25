"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";

import { cn } from "@/lib/cn";

/**
 * 选项定位层。两个默认值和 Base UI 不同：`sideOffset` 为 6，和 Select 一样在输入框外 6px 处展开；`align` 为
 * `start`，和输入框左边对齐，Base UI 默认居中。其余定位参数沿用 Base UI。
 */
export function ComboboxPositioner({
  sideOffset = 6,
  align = "start",
  className,
  ...props
}: ComboboxPrimitive.Positioner.Props) {
  return (
    <ComboboxPrimitive.Positioner
      data-slot="combobox-positioner"
      sideOffset={sideOffset}
      align={align}
      className={cn("z-50 outline-none", className)}
      {...props}
    />
  );
}
