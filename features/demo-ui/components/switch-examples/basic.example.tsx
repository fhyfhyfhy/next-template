"use client";

import { SwitchRoot, SwitchThumb } from "@/components/ui/switch";

export const metadata = {
  title: "Basic usage",
  description: "Has every import and the structure it needs; copy it as is.",
  order: 10,
};

/** The caller composes Root and Thumb explicitly. */
export function Example() {
  return (
    <label className="flex items-center gap-3 text-sm">
      <SwitchRoot defaultChecked>
        <SwitchThumb />
      </SwitchRoot>
      Turn on notifications
    </label>
  );
}
