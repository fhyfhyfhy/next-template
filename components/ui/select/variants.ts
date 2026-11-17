import { cva, type VariantProps } from "class-variance-authority";

export const selectTriggerVariants = cva(
  "flex w-full items-center justify-between gap-3 rounded-control border border-input bg-card text-left whitespace-nowrap text-card-foreground transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:focus-visible:ring-ring data-disabled:cursor-not-allowed data-disabled:opacity-40 data-placeholder:text-muted-foreground data-popup-open:border-ring [&_svg]:shrink-0",
  {
    variants: {
      size: {
        sm: "h-control-sm px-2.5 text-xs",
        md: "h-control-md px-3 text-sm",
        lg: "h-control-lg px-4 text-base",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export type SelectSize = NonNullable<
  VariantProps<typeof selectTriggerVariants>["size"]
>;

export const selectPopupVariants = cva(
  "max-h-(--available-height) max-w-(--available-width) min-w-[min(var(--anchor-width),var(--available-width))] origin-(--transform-origin) overflow-y-auto rounded-panel border border-border bg-popover text-popover-foreground shadow-popover transition-[opacity,scale] duration-200 ease-out outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
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

export const selectItemVariants = cva(
  "relative flex cursor-default items-center gap-2 rounded-control wrap-anywhere outline-none data-disabled:opacity-40 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
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
