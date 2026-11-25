"use client";

import { IconBold } from "@tabler/icons-react";
import { type SetStateAction, useState } from "react";

import { Toggle, type ToggleProps } from "@/components/ui/toggle";

export interface ToggleConfig {
  variant: NonNullable<ToggleProps["variant"]>;
  size: NonNullable<ToggleProps["size"]>;
  label: string;
  pressed: boolean;
  disabled: boolean;
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: ToggleConfig = (/* @example-config */ {
  "variant": "default",
  "size": "md",
  "label": "加粗",
  "pressed": false,
  "disabled": false
} /* @end-example-config */);

/** 不传 config 和 onConfigChange 时使用本地状态；UI catalog 页面两个一起传，面板与预览共享同一份配置。 */
export function TogglePlayground({
  config,
  onConfigChange,
}:
  | {
      config: ToggleConfig;
      onConfigChange: (config: SetStateAction<ToggleConfig>) => void;
    }
  | { config?: undefined; onConfigChange?: undefined } = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  return (
    <div className="flex justify-center py-6">
      <Toggle
        variant={state.variant}
        size={state.size}
        pressed={state.pressed}
        disabled={state.disabled}
        aria-label={state.label}
        onPressedChange={(pressed) =>
          change((previous) => ({ ...previous, pressed }))
        }
      >
        <IconBold aria-hidden />
      </Toggle>
    </div>
  );
}
