import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useId } from "react";

import {
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPopup,
  SelectPortal,
  SelectPositioner,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Allows only the given options, keeping the caller's string union type. */
export function OptionControl<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly Value[];
  onChange: (value: Value) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <span id={id} className="block font-mono text-xs text-muted-foreground">
        {label}
      </span>
      <SelectRoot
        size="sm"
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectTrigger aria-labelledby={id}>
          <SelectValue />
          <SelectIcon>
            <IconChevronDown className="size-3.5" aria-hidden />
          </SelectIcon>
        </SelectTrigger>
        <SelectPortal>
          <SelectPositioner sideOffset={5} alignItemWithTrigger={false}>
            <SelectPopup>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  <SelectItemText className="flex-1">{option}</SelectItemText>
                  <SelectItemIndicator>
                    <IconCheck className="size-3.5" aria-hidden />
                  </SelectItemIndicator>
                </SelectItem>
              ))}
            </SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </SelectRoot>
    </div>
  );
}
