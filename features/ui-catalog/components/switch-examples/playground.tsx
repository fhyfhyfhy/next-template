"use client";

import { type SetStateAction, useState } from "react";

import { FieldDescription, FieldRoot } from "@/components/ui/field";
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

/** 不传 config 和 onConfigChange 时使用本地状态；UI catalog 页面两个一起传，面板与预览共享同一份配置。 */
export function SwitchPlayground({
  config,
  onConfigChange,
}:
  | {
      config: SwitchConfig;
      onConfigChange: (config: SetStateAction<SwitchConfig>) => void;
    }
  | { config?: undefined; onConfigChange?: undefined } = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  return (
    <div className="rounded-panel border border-border bg-card p-5 text-card-foreground">
      {/* 说明放在 label 外面：label 里的文字都会进开关的名称。 */}
      <FieldRoot disabled={state.disabled}>
        <label className="flex items-center justify-between gap-5 text-sm">
          {state.label}
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
        </label>
        <FieldDescription>{state.description}</FieldDescription>
      </FieldRoot>
    </div>
  );
}
