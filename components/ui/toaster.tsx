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

// sonner 的样式不在 Tailwind 的 layer 里，类名覆盖不了；它读取这些变量，内联在容器上即可覆盖。
const baseStyle: ToasterStyle = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "var(--radius-panel)",
  // sonner 把关闭按钮放在起始侧（LTR 时左上）；内联值盖过它按 `dir` 切换的取值，两个方向都固定在右上。
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

/** toast 的容器，在根布局渲染一次；`toast()` 在任意客户端代码中调用。需要在 next-themes 的 ThemeProvider 内。 */
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
