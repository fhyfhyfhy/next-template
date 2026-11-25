"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "@/lib/cn";

/** 面板后面的背景，和面板一起淡入淡出。iOS 上相对 body 绝对定位的原因见 DialogBackdrop（components/ui/dialog/backdrop.tsx）。 */
export function DrawerBackdrop({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-backdrop"
      className={cn(
        "fixed inset-0 z-40 min-h-dvh bg-overlay backdrop-blur-overlay transition-opacity duration-250 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute",
        className,
      )}
      {...props}
    />
  );
}
