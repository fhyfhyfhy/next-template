"use client";

import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface FieldConfig {
  label: string;
  placeholder: string;
  invalid: boolean;
  error: string;
}

// 括号将结束标记保留在表达式内；展示页只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: FieldConfig = (/* @example-config */ {
  "label": "项目名称",
  "placeholder": "例如：我的设计系统",
  "invalid": true,
  "error": "名称已被其他项目占用"
} /* @end-example-config */);

export function FieldPlayground({
  config = initialConfig,
}: { config?: FieldConfig } = {}) {
  return (
    <FieldRoot name="name" invalid={config.invalid} className="w-full max-w-xs">
      <FieldLabel>{config.label}</FieldLabel>
      <Input placeholder={config.placeholder} />
      <FieldError match={config.invalid}>{config.error}</FieldError>
    </FieldRoot>
  );
}
