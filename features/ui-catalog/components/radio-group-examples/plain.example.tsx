"use client";

import { useState } from "react";

import { RadioGroup, RadioRoot } from "@/components/ui/radio-group";

export const metadata = {
  title: "自己画外观的选项",
  description:
    "plain 只画焦点 ring，内容用 group-data-checked: 表示是否选中，比如手机日历里选一天。调用方用 value 和 onValueChange 持有选中值。",
  order: 20,
};

const days = [7, 8, 9, 10, 11];

/** 选一天：每一天是圆圈里的数字，选中时填满。 */
export function Example() {
  const [day, setDay] = useState(8);
  return (
    <div className="space-y-2 text-sm">
      <RadioGroup<number>
        aria-label="日期"
        value={day}
        onValueChange={setDay}
        className="grid-cols-5 gap-1"
      >
        {days.map((each) => (
          <RadioRoot
            key={each}
            value={each}
            variant="plain"
            aria-label={`1 月 ${each} 日`}
            className="flex justify-center py-1"
          >
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full tabular-nums group-data-checked:bg-primary group-data-checked:text-primary-foreground"
            >
              {each}
            </span>
          </RadioRoot>
        ))}
      </RadioGroup>
      <p className="text-muted-foreground">{`已选 1 月 ${day} 日`}</p>
    </div>
  );
}
