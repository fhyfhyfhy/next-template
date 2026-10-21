"use client";

import { IconCheck, IconMinus } from "@tabler/icons-react";
import { useState } from "react";

import { CheckboxIndicator, CheckboxRoot } from "@/components/ui/checkbox";

export const metadata = {
  title: "全选与混合状态",
  description: "Root 与 Indicator 独立组合，混合状态由选中项计算。",
  order: 20,
};

/** 混合状态由调用方根据选中项计算。 */
export function Example() {
  const [selected, setSelected] = useState(["设计"]);
  const options = ["设计", "开发", "产品"];
  const all = selected.length === options.length;
  const mixed = selected.length > 0 && !all;
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 text-sm font-medium">
        <CheckboxRoot
          checked={all}
          indeterminate={mixed}
          onCheckedChange={(checked) => setSelected(checked ? options : [])}
        >
          <CheckboxIndicator>
            {mixed ? <IconMinus aria-hidden /> : <IconCheck aria-hidden />}
          </CheckboxIndicator>
        </CheckboxRoot>
        选择全部
      </label>
      <div className="space-y-3 border-l border-border pl-5">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-3 text-sm">
            <CheckboxRoot
              checked={selected.includes(option)}
              onCheckedChange={(checked) =>
                setSelected(
                  checked
                    ? [...selected, option]
                    : selected.filter((item) => item !== option),
                )
              }
            >
              <CheckboxIndicator>
                <IconCheck aria-hidden />
              </CheckboxIndicator>
            </CheckboxRoot>
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}
