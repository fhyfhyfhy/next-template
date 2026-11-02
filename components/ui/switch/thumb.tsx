"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/cn";

/** 开关滑块，默认尺寸跟随 Root 的 size。 */
export function SwitchThumb({
  className,
  ...props
}: SwitchPrimitive.Thumb.Props) {
  return (
    <SwitchPrimitive.Thumb
      data-slot="switch-thumb"
      className={cn(
        "rounded-full bg-white shadow-sm transition-transform duration-150 group-data-[size=lg]/switch:size-6 group-data-[size=md]/switch:size-5 group-data-[size=sm]/switch:size-4 data-checked:translate-x-full motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}
