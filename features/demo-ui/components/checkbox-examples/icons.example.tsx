"use client";

import { IconCheck } from "@tabler/icons-react";

import { CheckboxIndicator, CheckboxRoot } from "@/components/ui/checkbox";

export const metadata = {
  title: "Icon size",
  description:
    "An md checkbox's icon defaults to 14px; size-4 sets it to 16px.",
  order: 40,
};

/** Root's size stays as it is; the caller customizes the icon on its own. */
export function Example() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <label className="flex items-center gap-3 text-sm">
        <CheckboxRoot defaultChecked>
          <CheckboxIndicator>
            <IconCheck aria-hidden />
          </CheckboxIndicator>
        </CheckboxRoot>
        Default 14px
      </label>
      <label className="flex items-center gap-3 text-sm">
        <CheckboxRoot defaultChecked>
          <CheckboxIndicator>
            <IconCheck className="size-4" aria-hidden />
          </CheckboxIndicator>
        </CheckboxRoot>
        Custom 16px
      </label>
    </div>
  );
}
