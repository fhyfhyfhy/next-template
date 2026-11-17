import { FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";

import { CONTROL_LABEL_CLASS } from "../constants/control-label";

/** 参数面板的文字输入。受控输入框在 hydration 之前输入的字会被 hydration 盖掉，所以 hydration 之前不可用。 */
export function TextControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const hydrated = useHydrated();
  return (
    <FieldRoot disabled={!hydrated} className="gap-2">
      <FieldLabel className={CONTROL_LABEL_CLASS}>{label}</FieldLabel>
      <Input size="sm" value={value} onValueChange={onChange} />
    </FieldRoot>
  );
}
