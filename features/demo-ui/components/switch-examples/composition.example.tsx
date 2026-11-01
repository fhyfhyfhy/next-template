"use client";

import { useState } from "react";

import { SwitchRoot, SwitchThumb } from "@/components/ui/switch";

export const metadata = {
  title: "Controlled state and a custom thumb",
  description:
    "Thumb is restyled on its own; the text outside follows the switch's state.",
  order: 20,
};

/** One state drives both the switch and the text outside it. */
export function Example() {
  const [checked, setChecked] = useState(false);
  return (
    <div className="space-y-4 text-center">
      <label className="flex items-center justify-center gap-3 text-sm">
        <SwitchRoot checked={checked} onCheckedChange={setChecked}>
          <SwitchThumb className="rounded-control" />
        </SwitchRoot>
        Focus mode
      </label>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {checked
          ? "Non-essential notifications paused"
          : "Receiving all notifications"}
      </p>
    </div>
  );
}
