"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";

export interface BadgeConfig {
  variant: NonNullable<BadgeProps["variant"]>;
  label: string;
}

// The parentheses keep the end marker inside the expression; the UI demo page
// replaces only the initial JSON between the markers.
// prettier-ignore
export const initialConfig: BadgeConfig = (/* @example-config */ {
  "variant": "primary",
  "label": "Generating"
} /* @end-example-config */);

/**
 * Without a config it uses initialConfig; the UI demo page passes the panel's
 * config.
 */
export function BadgePlayground({
  config = initialConfig,
}: { config?: BadgeConfig } = {}) {
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
