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

// The parentheses keep the end marker inside the expression; the UI demo page
// replaces only the initial JSON between the markers.
// prettier-ignore
export const initialConfig: ButtonConfig = (/* @example-config */ {
  "variant": "primary",
  "size": "md",
  "disabled": false,
  "focusableWhenDisabled": false,
  "label": "Start creating",
  "icon": "arrow"
} /* @end-example-config */);

/**
 * Without a config it uses initialConfig; the UI demo page passes one config
 * that the panel and the preview share.
 */
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
        Clicked {clicks} times
      </span>
    </div>
  );
}
