"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/cn";

/**
 * 提示的文字，放在调用方提供的 Positioner 内，颜色和页面反过来。从触发器那一侧放大、淡入，快到不拖住经过的指针；
 * TooltipProvider 里已有提示打开时，下一个直接出现（data-instant）。
 * 提示只是给用指针和键盘的人看的补充：触控设备上不出现，读屏用户也拿不到，触发器另用和提示一致的 aria-label 命名
 * （node_modules/@base-ui/react/docs/react/components/tooltip.md 的 Usage guidelines）。
 */
export function TooltipPopup({
  className,
  ...props
}: TooltipPrimitive.Popup.Props) {
  return (
    <TooltipPrimitive.Popup
      data-slot="tooltip-popup"
      className={cn(
        "max-w-xs origin-(--transform-origin) rounded-control bg-foreground px-2 py-1 text-xs wrap-anywhere text-background shadow-popover transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-97 data-ending-style:opacity-0 data-instant:duration-0 data-starting-style:scale-97 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}
