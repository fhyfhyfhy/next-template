import { SwitchRoot, SwitchThumb } from "@/components/ui/switch";

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
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
      <SwitchRoot size="sm" checked={value} onCheckedChange={onChange}>
        <SwitchThumb />
      </SwitchRoot>
    </label>
  );
}
