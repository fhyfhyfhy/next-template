"use client";

import { IconArrowRight, IconPlus } from "@tabler/icons-react";
import { useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

export interface ButtonConfig {
  variant: NonNullable<ButtonProps["variant"]>;
  size: NonNullable<ButtonProps["size"]>;
  disabled: boolean;
  focusableWhenDisabled: boolean;
  label: string;
  icon: "none" | "arrow" | "plus";
}

// 括号将结束标记保留在表达式内；展示页只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: ButtonConfig = (/* @example-config */ {
  "variant": "primary",
  "size": "md",
  "disabled": false,
  "focusableWhenDisabled": false,
  "label": "开始创建",
  "icon": "arrow"
} /* @end-example-config */);

/** 不传参数时使用本地状态；展示页传入同一份配置供面板与预览共享。 */
export function ButtonPlayground({ config }: { config?: ButtonConfig } = {}) {
  const state = config ?? initialConfig;
  const [clicks, setClicks] = useState(0);
  return (
    <div className="flex flex-col items-center gap-5">
      <Button
        variant={state.variant}
        size={state.size}
        disabled={state.disabled}
        focusableWhenDisabled={state.focusableWhenDisabled}
        onClick={() => setClicks((count) => count + 1)}
      >
        {state.icon === "plus" && <IconPlus aria-hidden />}
        {state.label}
        {state.icon === "arrow" && <IconArrowRight aria-hidden />}
      </Button>
      <span aria-live="polite" className="text-xs text-muted-foreground">
        已触发 {clicks} 次
      </span>
    </div>
  );
}
