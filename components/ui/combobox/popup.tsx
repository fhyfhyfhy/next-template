"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { use } from "react";

import { cn } from "@/lib/cn";

import { ComboboxSizeContext } from "./context";
import { comboboxPopupVariants } from "./variants";

/** 选项面板，和输入框一样宽，放在调用方提供的 Positioner 内；选项超过 20rem 或窗口剩下的高度时滚动。 */
export function ComboboxPopup({
  className,
  ...props
}: ComboboxPrimitive.Popup.Props) {
  const size = use(ComboboxSizeContext);
  return (
    <ComboboxPrimitive.Popup
      data-slot="combobox-popup"
      data-size={size}
      className={cn(comboboxPopupVariants({ size }), className)}
      {...props}
    />
  );
}
