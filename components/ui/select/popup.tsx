"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { use } from "react";

import { cn } from "@/lib/cn";

import { SelectSizeContext } from "./context";
import { selectPopupVariants } from "./variants";

/** The options panel, placed inside a Positioner the caller provides. */
export function SelectPopup({
  className,
  ...props
}: SelectPrimitive.Popup.Props) {
  const size = use(SelectSizeContext);
  return (
    <SelectPrimitive.Popup
      data-slot="select-popup"
      data-size={size}
      className={cn(selectPopupVariants({ size }), className)}
      {...props}
    />
  );
}
