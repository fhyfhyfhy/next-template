"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";

import { ComboboxSizeContext } from "./context";
import type { ComboboxSize } from "./variants";

export interface ComboboxRootProps<
  Value,
  Multiple extends boolean | undefined = false,
> extends ComboboxPrimitive.Root.Props<Value, Multiple> {
  size?: ComboboxSize;
}

/** 可输入筛选的下拉选择的根节点；size 统一控制输入框和 Portal 内选项的尺寸。 */
export function ComboboxRoot<
  Value,
  Multiple extends boolean | undefined = false,
>({ size = "md", ...props }: ComboboxRootProps<Value, Multiple>) {
  return (
    <ComboboxSizeContext value={size}>
      <ComboboxPrimitive.Root<Value, Multiple> {...props} />
    </ComboboxSizeContext>
  );
}

export const ComboboxPortal = ComboboxPrimitive.Portal;
export const ComboboxList = ComboboxPrimitive.List;
export const ComboboxItemIndicator = ComboboxPrimitive.ItemIndicator;
export { ComboboxInput } from "./input";
export { ComboboxPositioner } from "./positioner";
export { ComboboxPopup } from "./popup";
export { ComboboxItem } from "./item";
export { ComboboxEmpty } from "./empty";
export { ComboboxStatus } from "./status";
export type { ComboboxSize } from "./variants";
