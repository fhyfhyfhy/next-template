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
} from "@/components/ui/combobox";
import { FieldLabel, FieldRoot } from "@/components/ui/field";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

const languages = ["简体中文", "English", "日本語", "한국어", "Français"];

/** Root 按输入筛选 items，List 渲染剩下的每一项，一项都不剩时 Empty 才说话。FieldLabel 给输入框命名。 */
export function Example() {
  return (
    <FieldRoot className="w-full max-w-xs">
      <FieldLabel>语言</FieldLabel>
      <ComboboxRoot items={languages}>
        <ComboboxInput placeholder="输入以筛选" />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxEmpty>没有匹配的语言。</ComboboxEmpty>
              <ComboboxList>
                {(language: string) => (
                  <ComboboxItem key={language} value={language}>
                    <span className="flex-1">{language}</span>
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
