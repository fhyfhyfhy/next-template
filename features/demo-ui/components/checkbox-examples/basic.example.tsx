"use client";

import { IconCheck } from "@tabler/icons-react";

import { CheckboxIndicator, CheckboxRoot } from "@/components/ui/checkbox";

export const metadata = {
  title: "Basic usage",
  description: "Has every import and the structure it needs; copy it as is.",
  order: 10,
};

/** The caller composes Root and Indicator explicitly. */
export function Example() {
  return (
    <label className="flex items-center gap-3 text-sm">
      <CheckboxRoot defaultChecked>
        <CheckboxIndicator>
          <IconCheck aria-hidden />
        </CheckboxIndicator>
      </CheckboxRoot>
      I have read the terms of use
    </label>
  );
}
