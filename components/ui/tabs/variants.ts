import { cva, type VariantProps } from "class-variance-authority";

// 灰色底槽里放各个 tab；竖排时（data-orientation=vertical）高度随内容，tab 竖着排。relative 和 isolate 让
// TabsIndicator 相对它定位，并且画在底槽的底色之上、tab 的文字之下。
export const tabsListVariants = cva(
  "group/tabs-list relative isolate inline-flex w-fit items-center rounded-control bg-muted text-muted-foreground data-[orientation=vertical]:h-auto data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
  {
    variants: {
      size: {
        sm: "h-control-sm gap-0.5 p-0.5",
        md: "h-control-md gap-1 p-1",
        lg: "h-control-lg gap-1 p-1",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export type TabsSize = NonNullable<
  VariantProps<typeof tabsListVariants>["size"]
>;

// rounded-md 比底槽的 rounded-control 小一圈，嵌在内边距里看起来同心。选中的 tab 自己带白底，TabsIndicator 显示出来
// 以后改由它画、滑到新选中的 tab：Base UI 在 hydrate 后量出位置之前给它带着 hidden，服务端的 HTML 里靠 tab 自己的白底
// 标出选中项。竖排时 tab 高度随内容，补上下内边距、文字靠左。
// 强制颜色模式会去掉底色和阴影：data-active:outline-hidden 这时画一圈系统色的 outline，平时不画（见 app/globals.css
// 的 focus-ring），负 offset 画在 tab 内侧。
export const tabsTabVariants = cva(
  "inline-flex h-full items-center justify-center gap-2 rounded-md whitespace-nowrap focus-ring transition-[color,background-color,box-shadow] duration-150 not-data-disabled:hover:text-foreground data-active:bg-card data-active:text-foreground data-active:shadow-xs data-active:outline-hidden data-active:-outline-offset-2 group-has-[[data-slot=tabs-indicator]:not([hidden])]/tabs-list:data-active:bg-transparent group-has-[[data-slot=tabs-indicator]:not([hidden])]/tabs-list:data-active:shadow-none data-disabled:cursor-not-allowed data-disabled:opacity-40 data-[orientation=vertical]:h-auto data-[orientation=vertical]:justify-start data-[orientation=vertical]:py-1.5 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      size: {
        sm: "px-2.5 text-xs",
        md: "px-3 text-sm",
        lg: "px-4 text-base",
      },
    },
    defaultVariants: { size: "md" },
  },
);
