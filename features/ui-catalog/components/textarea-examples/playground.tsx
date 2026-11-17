"use client";

import { FieldDescription, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export interface TextareaConfig {
  label: string;
  description: string;
  placeholder: string;
  rows: number;
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean;
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: TextareaConfig = (/* @example-config */ {
  "label": "项目简介",
  "description": "显示在项目主页的名称下面。",
  "placeholder": "一两句话说明这个项目做什么",
  "rows": 3,
  "disabled": false,
  "readOnly": false,
  "invalid": false
} /* @end-example-config */);

/** 不传参数时使用初始配置；UI catalog 页面传入面板里的配置。输入框不受控，输入的内容由浏览器保存。 */
export function TextareaPlayground({
  config = initialConfig,
}: { config?: TextareaConfig } = {}) {
  return (
    <FieldRoot invalid={config.invalid} disabled={config.disabled}>
      <FieldLabel>{config.label}</FieldLabel>
      <Textarea
        rows={config.rows}
        placeholder={config.placeholder}
        readOnly={config.readOnly}
      />
      <FieldDescription>{config.description}</FieldDescription>
    </FieldRoot>
  );
}
