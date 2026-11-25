"use client";

import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/lib/cn";

export type RadioGroupProps<Value = string> = RadioGroupPrimitive.Props<Value>;

/**
 * 一组只能选中一个的 RadioRoot：持有选中的值，`value` 和 `onValueChange` 一起传时受控，传 `defaultValue` 时自己持有；
 * 方向键在选项之间移动选中。用 aria-labelledby 指向可见的组名，没有可见组名时传 aria-label。
 */
export function RadioGroup<Value = string>({
  className,
  ...props
}: RadioGroupProps<Value>) {
  return (
    <RadioGroupPrimitive<Value>
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  );
}
