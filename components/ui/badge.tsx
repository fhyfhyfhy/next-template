import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      // 名称沿用 Button 的 variant；muted 是 Badge 自己需要的低强调样式。
      variant: {
        primary: "border-transparent bg-primary text-primary-foreground",
        muted: "border-transparent bg-muted text-foreground",
        outline: "border-border text-muted-foreground",
        danger: "border-transparent bg-destructive text-white",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export interface BadgeProps
  extends
    useRender.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

/** 状态或分类的小标签，默认渲染 span，可以用 `render` 换成链接等元素。 */
export function Badge({
  variant = "primary",
  className,
  render,
  ...props
}: BadgeProps) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { className: cn(badgeVariants({ variant }), className) },
      props,
    ),
    render,
    state: { slot: "badge", variant },
  });
}
