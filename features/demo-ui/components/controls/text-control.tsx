import { useId } from "react";

import { Input } from "@/components/ui/input";

/** A text input for the controls panel. */
export function TextControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block font-mono text-xs text-muted-foreground"
      >
        {label}
      </label>
      <Input id={id} size="sm" value={value} onValueChange={onChange} />
    </div>
  );
}
