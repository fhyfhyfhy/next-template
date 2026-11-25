"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

/** 包住整个应用一次（app/providers.tsx）：第一个提示出现后，指针移到相邻的触发器上，下一个立即出现。 */
export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipPortal = TooltipPrimitive.Portal;
export { TooltipPositioner } from "./positioner";
export { TooltipPopup } from "./popup";
