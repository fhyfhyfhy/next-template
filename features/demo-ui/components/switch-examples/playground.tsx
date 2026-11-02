"use client";

import { type SetStateAction, useId, useState } from "react";

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

// 括号将结束标记保留在表达式内；UI demo 页面只替换标记之间的 JSON 初始值。
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

/** 不传参数时使用本地状态；UI demo 页面传入同一份配置供面板与预览共享。 */
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
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-5 rounded-panel border border-border bg-card p-5 text-card-foreground">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {state.label}
        </label>
        <p id={`${id}-hint`} className="mt-1 text-xs/5 text-muted-foreground">
          {state.description}
        </p>
      </div>
      <SwitchRoot
        id={id}
        size={state.size}
        checked={state.checked}
        disabled={state.disabled}
        readOnly={state.readOnly}
        required={state.required}
        aria-describedby={`${id}-hint`}
        onCheckedChange={(checked) =>
          change((previous) => ({ ...previous, checked }))
        }
      >
        <SwitchThumb />
      </SwitchRoot>
    </div>
  );
}
