"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/cn";

/** 弹层背景，可单独调整颜色、透明度和模糊效果。 */
export function DialogBackdrop({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      // iOS 26 起 Safari 界面下方也露出页面，fixed 盖不到那里；iOS 上改为相对 body 绝对定位，
      // 所以 app/globals.css 的 body 带 relative
      // （node_modules/@base-ui/react/docs/react/overview/quick-start.md 的「iOS 26+ Safari」一节）。
      className={cn(
        "fixed inset-0 z-40 min-h-dvh bg-overlay backdrop-blur-overlay transition-opacity duration-250 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute",
        className,
      )}
      {...props}
    />
  );
}
