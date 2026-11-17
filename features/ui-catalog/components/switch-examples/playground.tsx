"use client";

import { type SetStateAction, useState } from "react";

import { FieldDescription, FieldLabel, FieldRoot } from "@/components/ui/field";
import {
  SwitchRoot,
  type SwitchRootProps,
  SwitchThumb,
} from "@/components/ui/switch";

export interface SwitchConfig {
  size: NonNullable<SwitchRootProps["size"]>;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: SwitchConfig = (/* @example-config */ {
  "size": "md",
  "label": "自动保存",
  "description": "修改内容后自动保存到云端。",
  "checked": true,
  "disabled": false,
  "readOnly": false,
  "required": false
} /* @end-example-config */);

/** 不传参数时使用本地状态；UI catalog 页面传入同一份配置供面板与预览共享。 */
export function SwitchPlayground({
  config,
  onConfigChange,
}: {
  config?: SwitchConfig;
  onConfigChange?: (config: SetStateAction<SwitchConfig>) => void;
} = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  return (
    <div className="rounded-panel border border-border bg-card p-5 text-card-foreground">
      <FieldRoot
        disabled={state.disabled}
        className="flex-row items-center justify-between gap-5"
      >
        <div className="flex flex-col gap-1">
          <FieldLabel>{state.label}</FieldLabel>
          <FieldDescription>{state.description}</FieldDescription>
        </div>
        <SwitchRoot
          size={state.size}
          checked={state.checked}
          readOnly={state.readOnly}
          required={state.required}
          onCheckedChange={(checked) =>
            change((previous) => ({ ...previous, checked }))
          }
        >
          <SwitchThumb />
        </SwitchRoot>
      </FieldRoot>
    </div>
  );
}
