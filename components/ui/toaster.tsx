"use client";

import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconLoader,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "@/lib/cn";

export { toast } from "sonner";
export type { ToasterProps };

interface ToasterStyle extends CSSProperties {
  [variable: `--${string}`]: string;
}

// sonner's styles are outside Tailwind's layers, so class names can't override
// them. It reads these variables, so setting them inline on the container does.
const baseStyle: ToasterStyle = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "var(--radius-panel)",
  // sonner puts the close button on the start side (top left in LTR). These
  // inline values override the ones it switches by `dir`, pinning it top right
  // in both directions.
  "--toast-close-button-start": "unset",
  "--toast-close-button-end": "0",
  "--toast-close-button-transform": "translate(35%, -35%)",
};

const icons: ToasterProps["icons"] = {
  success: <IconCircleCheck className="size-4" />,
  info: <IconInfoCircle className="size-4" />,
  warning: <IconAlertTriangle className="size-4" />,
  error: <IconAlertOctagon className="size-4" />,
  loading: <IconLoader className="size-4 animate-spin" />,
};

/**
 * The container for toasts, rendered once in the root layout; call `toast()`
 * from any client code. Needs to be inside next-themes' ThemeProvider.
 */
export function Toaster({ style, toastOptions, ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      position="top-right"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      icons={icons}
      style={{ ...baseStyle, ...style }}
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast: cn("font-sans", toastOptions?.classNames?.toast),
        },
      }}
      {...props}
    />
  );
}
