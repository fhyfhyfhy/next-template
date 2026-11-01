import { SwitchRoot, SwitchThumb } from "@/components/ui/switch";

/** A boolean switch for the controls panel. */
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
