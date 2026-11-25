"use client";

import { IconCheck } from "@tabler/icons-react";

import {
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxRoot,
  type ComboboxSize,
} from "@/components/ui/combobox";
import { FieldLabel, FieldRoot } from "@/components/ui/field";

export interface ComboboxConfig {
  size: ComboboxSize;
  label: string;
  placeholder: string;
  emptyText: string;
  disabled: boolean;
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: ComboboxConfig = (/* @example-config */ {
  "size": "md",
  "label": "风格",
  "placeholder": "输入以筛选",
  "emptyText": "没有匹配的风格。",
  "disabled": false
} /* @end-example-config */);

const styleOptions = ["低多边形", "写实", "卡通", "体素", "手绘", "赛博朋克"];

/** 不传参数时使用初始配置；UI catalog 页面传入面板里的配置。 */
export function ComboboxPlayground({
  config = initialConfig,
}: { config?: ComboboxConfig } = {}) {
  return (
    <FieldRoot disabled={config.disabled} className="w-full max-w-xs">
      <FieldLabel>{config.label}</FieldLabel>
      <ComboboxRoot items={styleOptions} size={config.size}>
        <ComboboxInput placeholder={config.placeholder} />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxEmpty>{config.emptyText}</ComboboxEmpty>
              <ComboboxList>
                {(style: string) => (
                  <ComboboxItem key={style} value={style}>
                    <span className="flex-1">{style}</span>
                    <ComboboxItemIndicator>
                      <IconCheck className="size-4" aria-hidden />
                    </ComboboxItemIndicator>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    </FieldRoot>
  );
}
