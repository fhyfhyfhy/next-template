"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";

import { SelectSizeContext } from "./context";
import type { SelectSize } from "./variants";

export interface SelectRootProps<
  Value,
  Multiple extends boolean | undefined = false,
> extends SelectPrimitive.Root.Props<Value, Multiple> {
  size?: SelectSize;
}

/**
 * The select's root; size sets the size of both the trigger and the options in
 * the Portal.
 */
export function SelectRoot<
  Value,
  Multiple extends boolean | undefined = false,
>({ size = "md", ...props }: SelectRootProps<Value, Multiple>) {
  return (
    <SelectSizeContext value={size}>
      <SelectPrimitive.Root<Value, Multiple> {...props} />
    </SelectSizeContext>
  );
}

export const SelectGroup = SelectPrimitive.Group;
export const SelectGroupLabel = SelectPrimitive.GroupLabel;
export const SelectPortal = SelectPrimitive.Portal;
export const SelectBackdrop = SelectPrimitive.Backdrop;
export const SelectIcon = SelectPrimitive.Icon;
export const SelectItemText = SelectPrimitive.ItemText;
export const SelectItemIndicator = SelectPrimitive.ItemIndicator;
export const SelectList = SelectPrimitive.List;
export const SelectArrow = SelectPrimitive.Arrow;
export const SelectScrollUpArrow = SelectPrimitive.ScrollUpArrow;
export const SelectScrollDownArrow = SelectPrimitive.ScrollDownArrow;
export { SelectTrigger } from "./trigger";
export type { SelectTriggerProps } from "./trigger";
export { SelectPopup } from "./popup";
export { SelectPositioner } from "./positioner";
export { SelectItem } from "./item";
export { SelectValue } from "./value";
export type { SelectSize } from "./variants";
