import { IconCheck, IconChevronDown } from "@tabler/icons-react";

import {
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectLabel,
  SelectPopup,
  SelectPortal,
  SelectPositioner,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CONTROL_LABEL_CLASS } from "../constants/control-label";

/** 只允许从给定选项中选择，保留调用方的字符串联合类型。 */
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
  return (
    <div className="space-y-2">
      <SelectRoot
        size="sm"
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectLabel className={CONTROL_LABEL_CLASS}>{label}</SelectLabel>
        <SelectTrigger>
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
