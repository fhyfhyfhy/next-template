"use client";

import { IconCheck, IconMinus } from "@tabler/icons-react";
import { useState } from "react";

import { CheckboxIndicator, CheckboxRoot } from "@/components/ui/checkbox";

export const metadata = {
  title: "Select all and the mixed state",
  description:
    "Root and Indicator compose separately; the mixed state is computed from the checked items.",
  order: 20,
};

/** The caller computes the mixed state from the checked items. */
export function Example() {
  const [selected, setSelected] = useState(["Design"]);
  const options = ["Design", "Engineering", "Product"];
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
        Select all
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
