import { useId } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

import { CONTROL_LABEL_CLASS } from "../constants/control-label";

/** 参数面板的文字输入。 */
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
      <label htmlFor={id} className={cn("block", CONTROL_LABEL_CLASS)}>
        {label}
      </label>
      <Input id={id} size="sm" value={value} onValueChange={onChange} />
    </div>
  );
}
