"use client";

import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface FieldConfig {
  label: string;
  placeholder: string;
  invalid: boolean;
  error: string;
}

// The parentheses keep the end marker inside the expression; the UI demo page
// replaces only the initial JSON between the markers.
// prettier-ignore
export const initialConfig: FieldConfig = (/* @example-config */ {
  "label": "Project name",
  "placeholder": "e.g. My design system",
  "invalid": true,
  "error": "Another project already uses this name"
} /* @end-example-config */);

export function FieldPlayground({
  config = initialConfig,
}: { config?: FieldConfig } = {}) {
  return (
    <FieldRoot name="name" invalid={config.invalid} className="w-full max-w-xs">
      <FieldLabel>{config.label}</FieldLabel>
      <Input placeholder={config.placeholder} />
      <FieldError match={config.invalid}>{config.error}</FieldError>
    </FieldRoot>
  );
}
