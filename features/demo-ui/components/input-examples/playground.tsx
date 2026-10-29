"use client";

import { type SetStateAction, useId, useState } from "react";

import { Input, type InputProps } from "@/components/ui/input";

export interface InputConfig {
  size: NonNullable<InputProps["size"]>;
  type: "text" | "email" | "password" | "number";
  label: string;
  description: string;
  placeholder: string;
  value: string;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  invalid: boolean;
}

// 括号将结束标记保留在表达式内；展示页只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: InputConfig = (/* @example-config */ {
  "size": "md",
  "type": "text",
  "label": "项目名称",
  "description": "给你的下一个想法起个名字。",
  "placeholder": "例如：我的设计系统",
  "value": "",
  "disabled": false,
  "readOnly": false,
  "required": false,
  "invalid": false
} /* @end-example-config */);

/** 不传参数时使用本地状态；展示页传入同一份配置供面板与预览共享。 */
export function InputPlayground({
  config,
  onConfigChange,
}: {
  config?: InputConfig;
  onConfigChange?: (config: SetStateAction<InputConfig>) => void;
} = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {state.label}
        {state.required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <Input
        id={id}
        size={state.size}
        type={state.type}
        value={state.value}
        placeholder={state.placeholder}
        disabled={state.disabled}
        readOnly={state.readOnly}
        required={state.required}
        aria-invalid={state.invalid}
        aria-describedby={`${id}-description`}
        onValueChange={(value) =>
          change((previous) => ({ ...previous, value }))
        }
      />
      <p
        id={`${id}-description`}
        className={
          state.invalid
            ? "text-xs text-destructive"
            : "text-xs text-muted-foreground"
        }
      >
        {state.description}
      </p>
    </div>
  );
}
