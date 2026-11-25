"use client";

import { type SetStateAction, useId, useState } from "react";

import { labelVariants } from "@/components/ui/field";
import {
  RadioGroup,
  RadioIndicator,
  RadioRoot,
  type RadioRootProps,
} from "@/components/ui/radio-group";

export interface RadioGroupConfig {
  size: NonNullable<RadioRootProps["size"]>;
  label: string;
  value: "day" | "week" | "month";
  disabled: boolean;
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: RadioGroupConfig = (/* @example-config */ {
  "size": "md",
  "label": "视图",
  "value": "week",
  "disabled": false
} /* @end-example-config */);

const options = [
  { value: "day", label: "按日" },
  { value: "week", label: "按周" },
  { value: "month", label: "按月" },
] as const;

/**
 * 组名是一个可见的标题，RadioGroup 用 aria-labelledby 指向它；每个选项由包住它的 label 命名。
 * 不传 config 和 onConfigChange 时使用本地状态；UI catalog 页面两个一起传，面板与预览共享同一份配置。
 */
export function RadioGroupPlayground({
  config,
  onConfigChange,
}:
  | {
      config: RadioGroupConfig;
      onConfigChange: (config: SetStateAction<RadioGroupConfig>) => void;
    }
  | { config?: undefined; onConfigChange?: undefined } = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  const labelId = useId();
  return (
    <div className="space-y-2">
      <div id={labelId} className={labelVariants()}>
        {state.label}
      </div>
      <RadioGroup<RadioGroupConfig["value"]>
        aria-labelledby={labelId}
        value={state.value}
        disabled={state.disabled}
        onValueChange={(value) =>
          change((previous) => ({ ...previous, value }))
        }
      >
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <RadioRoot value={option.value} size={state.size}>
              <RadioIndicator />
            </RadioRoot>
            {option.label}
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
