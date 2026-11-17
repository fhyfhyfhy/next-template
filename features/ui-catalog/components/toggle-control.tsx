import { SwitchRoot, SwitchThumb } from "@/components/ui/switch";

import { CONTROL_LABEL_CLASS } from "../constants/control-label";

/** 参数面板的布尔开关。 */
export function ToggleControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-1">
      <span className={CONTROL_LABEL_CLASS}>{label}</span>
      <SwitchRoot size="sm" checked={value} onCheckedChange={onChange}>
        <SwitchThumb />
      </SwitchRoot>
    </label>
  );
}
