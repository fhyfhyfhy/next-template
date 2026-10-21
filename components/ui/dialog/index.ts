"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

export const DialogRoot = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogViewport = DialogPrimitive.Viewport;
export { DialogPopup } from "./popup";
export type { DialogPopupProps } from "./popup";
export { DialogBackdrop } from "./backdrop";
export { DialogTitle } from "./title";
export { DialogDescription } from "./description";
