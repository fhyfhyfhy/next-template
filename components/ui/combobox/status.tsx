"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { use } from "react";

import { cn } from "@/lib/cn";

import { ComboboxSizeContext } from "./context";
import { comboboxNoteVariants } from "./variants";

/** 边输入边加载的选项的状态，比如“正在搜索…”，读屏礼貌地播报。弹层渲染时一直渲染它、只换 children，没有文字时不占位置。 */
export function ComboboxStatus({
  className,
  ...props
}: ComboboxPrimitive.Status.Props) {
  const size = use(ComboboxSizeContext);
  return (
    <ComboboxPrimitive.Status
      data-slot="combobox-status"
      className={cn(comboboxNoteVariants({ size }), className)}
      {...props}
    />
  );
}
