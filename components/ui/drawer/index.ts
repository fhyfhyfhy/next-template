"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

export const DrawerRoot = DrawerPrimitive.Root;
export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerClose = DrawerPrimitive.Close;
export const DrawerPortal = DrawerPrimitive.Portal;
export const DrawerViewport = DrawerPrimitive.Viewport;
export const DrawerContent = DrawerPrimitive.Content;
export { DrawerPopup } from "./popup";
export type { DrawerPopupProps } from "./popup";
export { DrawerBackdrop } from "./backdrop";
export { DrawerTitle } from "./title";
export { DrawerDescription } from "./description";
