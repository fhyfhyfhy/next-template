"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

// 面板占哪条边由 Root 的 swipeDirection 决定，Base UI 把它写在 data-swipe-direction 上：面板从那条边滑进滑出，
// 跟着朝那条边的滑动走（--drawer-swipe-movement-*，由 Viewport 设置）。translate-* 设置的是 translate 属性，
// transition-transform 覆盖它。
const drawerPopupVariants = cva(
  [
    "fixed z-50 flex flex-col overflow-y-auto border-border bg-popover p-5 text-popover-foreground shadow-popover transition-transform duration-250 ease-out outline-none data-swiping:transition-none sm:p-6",
    "data-[swipe-direction=right]:inset-y-0 data-[swipe-direction=right]:right-0 data-[swipe-direction=right]:w-full data-[swipe-direction=right]:translate-x-(--drawer-swipe-movement-x) data-[swipe-direction=right]:border-l data-[swipe-direction=right]:data-ending-style:translate-x-full data-[swipe-direction=right]:data-starting-style:translate-x-full",
    "data-[swipe-direction=left]:inset-y-0 data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:w-full data-[swipe-direction=left]:translate-x-(--drawer-swipe-movement-x) data-[swipe-direction=left]:border-r data-[swipe-direction=left]:data-ending-style:-translate-x-full data-[swipe-direction=left]:data-starting-style:-translate-x-full",
    "data-[swipe-direction=down]:inset-x-0 data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:max-h-[85dvh] data-[swipe-direction=down]:translate-y-(--drawer-swipe-movement-y) data-[swipe-direction=down]:rounded-t-panel data-[swipe-direction=down]:border-t data-[swipe-direction=down]:data-ending-style:translate-y-full data-[swipe-direction=down]:data-starting-style:translate-y-full",
    "data-[swipe-direction=up]:inset-x-0 data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:max-h-[85dvh] data-[swipe-direction=up]:translate-y-(--drawer-swipe-movement-y) data-[swipe-direction=up]:rounded-b-panel data-[swipe-direction=up]:border-b data-[swipe-direction=up]:data-ending-style:-translate-y-full data-[swipe-direction=up]:data-starting-style:-translate-y-full",
  ],
  {
    variants: {
      size: {
        sm: "data-[swipe-direction=left]:max-w-sm data-[swipe-direction=right]:max-w-sm",
        md: "data-[swipe-direction=left]:max-w-md data-[swipe-direction=right]:max-w-md",
        lg: "data-[swipe-direction=left]:max-w-xl data-[swipe-direction=right]:max-w-xl",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface DrawerPopupProps
  extends
    DrawerPrimitive.Popup.Props,
    VariantProps<typeof drawerPopupVariants> {}

/**
 * 抽屉面板，放在滑动需要的 DrawerViewport 内；调用方组合 Title、Description、DrawerContent 和可访问的 Close。
 * 它的边、宽高和边框按 Root 的 swipeDirection 写在 `data-[swipe-direction=…]:` 下：className 要覆盖其中某项时带同样的
 * 前缀，比如 `data-[swipe-direction=right]:max-w-2xl`。`size` 限制从左右滑出的面板的宽度，对从上下滑出、占满页面宽度
 * 的面板不起作用。
 */
export function DrawerPopup({
  size = "md",
  className,
  ...props
}: DrawerPopupProps) {
  return (
    <DrawerPrimitive.Popup
      data-slot="drawer-popup"
      data-size={size}
      className={cn(drawerPopupVariants({ size }), className)}
      {...props}
    />
  );
}
