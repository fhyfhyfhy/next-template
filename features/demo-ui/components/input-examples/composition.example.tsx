"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";

export const metadata = {
  title: "Controlled input and validation",
  description: "Type one or two characters to see the linked error message.",
  order: 20,
};

/** The caller holds the value and the validation result. */
export function Example() {
  const [value, setValue] = useState("");
  const id = useId();
  const invalid = value.length > 0 && value.length < 3;
  return (
    <div className="w-full max-w-xs space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        Username
      </label>
      <Input
        id={id}
        value={value}
        onValueChange={setValue}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
        placeholder="At least 3 characters"
      />
      <p
        id={`${id}-hint`}
        className={
          invalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"
        }
      >
        {invalid
          ? "A username needs at least 3 characters."
          : "Shown on your profile."}
      </p>
    </div>
  );
}
