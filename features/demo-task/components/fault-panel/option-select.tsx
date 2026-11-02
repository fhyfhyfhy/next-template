"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";

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

interface OptionSelectProps<TValue extends string> {
  label: string;
  value: TValue;
  options: readonly { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
}

/**
 * A dropdown in the fault form: composes the project's Select, with the label
 * as the trigger's accessible name.
 */
export function OptionSelect<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: OptionSelectProps<TValue>) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <SelectRoot
        size="sm"
        items={options}
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
      >
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue />
          <SelectIcon>
            <IconChevronDown className="size-4" aria-hidden />
          </SelectIcon>
        </SelectTrigger>
        <SelectPortal>
          <SelectPositioner sideOffset={6} alignItemWithTrigger={false}>
            <SelectPopup>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <SelectItemText className="flex-1">
                    {option.label}
                  </SelectItemText>
                  <SelectItemIndicator>
                    <IconCheck className="size-4" aria-hidden />
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
