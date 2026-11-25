import { cva } from "class-variance-authority";

// MenuItem、MenuCheckboxItem、MenuRadioItem 共用。和 selectItemVariants（components/ui/select/variants.ts）一样，
// 强制颜色模式去掉 bg-accent 时由 data-highlighted:outline-hidden 画出的系统色 outline 标出高亮项，负 offset 画在项内侧。
export const menuItemVariants = cva(
  "flex min-h-control-sm cursor-default items-center gap-2 rounded-control px-2.5 py-1.5 wrap-anywhere outline-none select-none data-disabled:opacity-40 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:outline-hidden data-highlighted:-outline-offset-2 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);
