"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { type SetStateAction, useId, useState } from "react";

import {
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectList,
  SelectPopup,
  SelectPortal,
  SelectPositioner,
  SelectRoot,
  type SelectSize,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SelectConfig {
  size: SelectSize;
  label: string;
  placeholder: string;
  firstOption: string;
  values: string[];
  multiple: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  open: boolean;
  modal: boolean;
  disableLastOption: boolean;
  side: "top" | "bottom" | "left" | "right";
  align: "start" | "center" | "end";
  sideOffset: number;
  alignItemWithTrigger: boolean;
}

// 括号将结束标记保留在表达式内；UI demo 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: SelectConfig = (/* @example-config */ {
  "size": "md",
  "label": "你的角色",
  "placeholder": "选择一个角色",
  "firstOption": "设计师",
  "values": [
    "design"
  ],
  "multiple": false,
  "disabled": false,
  "readOnly": false,
  "required": false,
  "open": false,
  "modal": false,
  "disableLastOption": false,
  "side": "bottom",
  "align": "start",
  "sideOffset": 6,
  "alignItemWithTrigger": false
} /* @end-example-config */);

/** 保留 Root、Trigger、定位层和选项的独立组合边界。 */
export function SelectPlayground({
  config,
  onConfigChange,
}: {
  config?: SelectConfig;
  onConfigChange?: (config: SetStateAction<SelectConfig>) => void;
} = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  const id = useId();
  const items = [
    { value: "design", label: state.firstOption },
    { value: "engineering", label: "开发者" },
    { value: "product", label: "产品经理" },
  ];
  return (
    <div className="space-y-2">
      <span id={id} className="text-sm font-medium">
        {state.label}
        {state.required && <span className="ml-1 text-destructive">*</span>}
      </span>
      <SelectRoot<string, boolean>
        size={state.size}
        items={items}
        multiple={state.multiple}
        value={state.multiple ? state.values : (state.values[0] ?? null)}
        onValueChange={(value) =>
          change((previous) => ({
            ...previous,
            values: Array.isArray(value)
              ? value
              : value === null
                ? []
                : [value],
          }))
        }
        open={state.open}
        onOpenChange={(open) => change((previous) => ({ ...previous, open }))}
        disabled={state.disabled}
        readOnly={state.readOnly}
        required={state.required}
        modal={state.modal}
      >
        <SelectTrigger aria-labelledby={id}>
          <SelectValue placeholder={state.placeholder} />
          <SelectIcon>
            <IconChevronDown className="size-4" aria-hidden />
          </SelectIcon>
        </SelectTrigger>
        <SelectPortal>
          <SelectPositioner
            side={state.side}
            align={state.align}
            sideOffset={state.sideOffset}
            alignItemWithTrigger={state.alignItemWithTrigger}
          >
            <SelectPopup>
              <SelectList>
                {items.map((item) => (
                  <SelectItem
                    key={item.value}
                    value={item.value}
                    disabled={
                      state.disableLastOption && item.value === "product"
                    }
                  >
                    <SelectItemText className="flex-1">
                      {item.label}
                    </SelectItemText>
                    <SelectItemIndicator>
                      <IconCheck className="size-4" aria-hidden />
                    </SelectItemIndicator>
                  </SelectItem>
                ))}
              </SelectList>
            </SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </SelectRoot>
    </div>
  );
}
