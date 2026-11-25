"use client";

import {
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxRoot,
  type ComboboxSize,
} from "@/components/ui/combobox";
import { FieldLabel, FieldRoot } from "@/components/ui/field";

export const metadata = {
  title: "尺寸",
  description: "Root 的 size 同时决定输入框和选项的尺寸。",
  order: 30,
};

const cities = ["北京", "上海", "深圳", "杭州"];

function SizedCombobox({ size }: { size: ComboboxSize }) {
  return (
    <FieldRoot>
      <FieldLabel>{`城市（${size}）`}</FieldLabel>
      <ComboboxRoot items={cities} size={size}>
        <ComboboxInput placeholder="输入以筛选" />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxEmpty>没有匹配的城市。</ComboboxEmpty>
              <ComboboxList>
                {(city: string) => (
                  <ComboboxItem key={city} value={city}>
                    {city}
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

/** 同一个 Combobox 的三种尺寸。 */
export function Example() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <SizedCombobox size="sm" />
      <SizedCombobox size="md" />
      <SizedCombobox size="lg" />
    </div>
  );
}
