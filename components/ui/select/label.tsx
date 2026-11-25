"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";

import { labelVariants } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/**
 * 选择器的可见 label，外观和 FieldLabel 一样（labelVariants）。放在 SelectRoot 内：Base UI 用它给 trigger 命名，
 * 点击它聚焦 trigger。关联在浏览器里才建立；hydration 前就需要名称的 trigger 另传 aria-label。
 */
export function SelectLabel({
  className,
  ...props
}: SelectPrimitive.Label.Props) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(labelVariants(), className)}
      {...props}
    />
  );
}
