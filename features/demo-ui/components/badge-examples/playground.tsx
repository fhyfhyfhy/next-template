"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";

export interface BadgeConfig {
  variant: NonNullable<BadgeProps["variant"]>;
  label: string;
}

// 括号将结束标记保留在表达式内；展示页只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: BadgeConfig = (/* @example-config */ {
  "variant": "default",
  "label": "生成中"
} /* @end-example-config */);

/** 不传参数时使用初始配置；展示页传入面板里的配置。 */
export function BadgePlayground({
  config = initialConfig,
}: { config?: BadgeConfig } = {}) {
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
