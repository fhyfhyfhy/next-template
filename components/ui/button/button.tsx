import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

/** 供 Server/Client 组件复用按钮外观；链接可应用这些样式并保留原生语义。 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control border font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card data-disabled:cursor-not-allowed data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-primary text-primary-foreground not-data-disabled:hover:bg-primary-hover",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground not-data-disabled:hover:opacity-85",
        outline:
          "border-input bg-card text-card-foreground not-data-disabled:hover:bg-accent not-data-disabled:hover:text-accent-foreground",
        ghost:
          "border-transparent text-foreground not-data-disabled:hover:bg-accent not-data-disabled:hover:text-accent-foreground",
        danger:
          "border-transparent bg-destructive text-white not-data-disabled:hover:opacity-85",
      },
      size: {
        sm: "h-control-sm px-3 text-xs",
        md: "h-control-md px-4 text-sm",
        lg: "h-control-lg px-5 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonPrimitive.Props, VariantProps<typeof buttonVariants> {}

/** 带项目视觉变体的按钮，保留 Base UI 的 render、ref 和事件接口。 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
