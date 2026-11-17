import { FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
  return (
    <FieldRoot className="gap-2">
      <FieldLabel className={CONTROL_LABEL_CLASS}>{label}</FieldLabel>
      <Input size="sm" value={value} onValueChange={onChange} />
    </FieldRoot>
  );
}
