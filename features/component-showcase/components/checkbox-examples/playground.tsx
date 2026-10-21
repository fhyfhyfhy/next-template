"use client";

import { IconCheck, IconMinus } from "@tabler/icons-react";
import { type SetStateAction, useState } from "react";

import {
  CheckboxIndicator,
  CheckboxRoot,
  type CheckboxRootProps,
} from "@/components/ui/checkbox";

export interface CheckboxConfig {
  size: NonNullable<CheckboxRootProps["size"]>;
  label: string;
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
}

// 括号将结束标记保留在表达式内；展示页只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: CheckboxConfig = (/* @example-config */ {
  "size": "md",
  "label": "接收产品更新",
  "checked": true,
  "indeterminate": false,
  "disabled": false,
  "readOnly": false,
  "required": false
} /* @end-example-config */);

/** 不传参数时使用本地状态；展示页传入同一份配置供面板与预览共享。 */
export function CheckboxPlayground({
  config,
  onConfigChange,
}: {
  config?: CheckboxConfig;
  onConfigChange?: (config: SetStateAction<CheckboxConfig>) => void;
} = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  return (
    <label className="flex items-center justify-center gap-3 text-sm">
      <CheckboxRoot
        size={state.size}
        checked={state.checked}
        indeterminate={state.indeterminate}
        disabled={state.disabled}
        readOnly={state.readOnly}
        required={state.required}
        onCheckedChange={(checked) =>
          change((previous) => ({ ...previous, checked, indeterminate: false }))
        }
      >
        <CheckboxIndicator>
          {state.indeterminate ? (
            <IconMinus aria-hidden />
          ) : (
            <IconCheck aria-hidden />
          )}
        </CheckboxIndicator>
      </CheckboxRoot>
      {state.label}
      {state.required && <span className="text-destructive">*</span>}
    </label>
  );
}
