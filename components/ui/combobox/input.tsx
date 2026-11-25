"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { use } from "react";

import { inputVariants } from "@/components/ui/input";
import { cn } from "@/lib/cn";

import { ComboboxSizeContext } from "./context";

/**
 * 筛选选项的输入框，外观和 ComboboxRoot 尺寸下的 Input 一样，宽度由调用方通过 className 设置。放在 ComboboxRoot 内，
 * 用 FieldLabel 命名，没有可见 label 时传 aria-label：Base UI 的 Combobox.Label 只给 Trigger 命名
 * （node_modules/@base-ui/react/docs/react/components/combobox.md 的 Usage guidelines）。
 */
export function ComboboxInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) {
  const size = use(ComboboxSizeContext);
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      data-size={size}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}
