"use client";

import { IconCheck } from "@tabler/icons-react";
import { useId, useState } from "react";

import { CheckboxIndicator, CheckboxRoot } from "@/components/ui/checkbox";

export const metadata = {
  title: "Required checkbox",
  description:
    "Agreeing to the terms clears the error; unchecking shows it again.",
  order: 30,
};

/** The caller holds the checked state and the validation result. */
export function Example() {
  const [checked, setChecked] = useState(false);
  const descriptionId = useId();
  const invalid = !checked;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3 text-sm">
        <CheckboxRoot
          checked={checked}
          onCheckedChange={setChecked}
          required
          aria-invalid={invalid}
          aria-describedby={descriptionId}
        >
          <CheckboxIndicator>
            <IconCheck aria-hidden />
          </CheckboxIndicator>
        </CheckboxRoot>
        I have read and agree to the terms of use
      </label>
      <p
        id={descriptionId}
        className={
          invalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"
        }
      >
        {invalid
          ? "Agree to the terms of use first."
          : "You agreed to the terms of use and can continue."}
      </p>
    </div>
  );
}
