import { cva, type VariantProps } from "class-variance-authority";

// 尺寸和 Select 的弹层、选项一致（components/ui/select/variants.ts），表单里两种下拉并排时看起来一样。
export const comboboxPopupVariants = cva(
  "max-h-[min(var(--available-height),20rem)] w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-panel border border-border bg-popover text-popover-foreground shadow-popover transition-[opacity,scale] duration-200 ease-out outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
  {
    variants: {
      size: {
        sm: "p-1 text-xs",
        md: "p-1.5 text-sm",
        lg: "p-2 text-base",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export type ComboboxSize = NonNullable<
  VariantProps<typeof comboboxPopupVariants>["size"]
>;

// 高亮项在强制颜色模式下的 outline 见 selectItemVariants 的说明。
export const comboboxItemVariants = cva(
  "flex cursor-default items-center gap-2 rounded-control wrap-anywhere outline-none data-disabled:opacity-40 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:outline-hidden data-highlighted:-outline-offset-2",
  {
    variants: {
      size: {
        sm: "min-h-control-sm px-2.5 py-1.5",
        md: "min-h-control-md px-3 py-2",
        lg: "min-h-control-lg px-4 py-2.5",
      },
    },
    defaultVariants: { size: "md" },
  },
);

/** 弹层里不是选项的一行文字（没有匹配项、正在搜索）的内边距，和选项对齐；没有文字时不占位置。 */
export const comboboxNoteVariants = cva("text-muted-foreground empty:p-0", {
  variants: {
    size: {
      sm: "px-2.5 py-1.5",
      md: "px-3 py-2",
      lg: "px-4 py-2.5",
    },
  },
  defaultVariants: { size: "md" },
});
