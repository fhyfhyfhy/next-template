"use client";

import { type SetStateAction, useState } from "react";

import { FieldDescription, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input, type InputProps } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";

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

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
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

/** 不传 config 和 onConfigChange 时使用本地状态；UI catalog 页面两个一起传，面板与预览共享同一份配置。 */
export function InputPlayground({
  config,
  onConfigChange,
}:
  | {
      config: InputConfig;
      onConfigChange: (config: SetStateAction<InputConfig>) => void;
    }
  | { config?: undefined; onConfigChange?: undefined } = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  // 受控输入框在 hydration 之前输入的字会被 hydration 盖掉，所以先不可用。
  const hydrated = useHydrated();
  return (
    <FieldRoot invalid={state.invalid} disabled={state.disabled || !hydrated}>
      <FieldLabel>
        {state.label}
        {state.required && (
          <span aria-hidden className="ml-1 text-destructive">
            *
          </span>
        )}
      </FieldLabel>
      <Input
        size={state.size}
        type={state.type}
        value={state.value}
        placeholder={state.placeholder}
        readOnly={state.readOnly}
        required={state.required}
        onValueChange={(value) =>
          change((previous) => ({ ...previous, value }))
        }
      />
      <FieldDescription>{state.description}</FieldDescription>
    </FieldRoot>
  );
}
