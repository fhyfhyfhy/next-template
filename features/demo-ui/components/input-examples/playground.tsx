"use client";

import { type SetStateAction, useId, useState } from "react";

import { Input, type InputProps } from "@/components/ui/input";

export interface InputConfig {
  size: NonNullable<InputProps["size"]>;
  type: "text" | "email" | "password" | "number";
  label: string;
  description: string;
  placeholder: string;
  value: string;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  invalid: boolean;
}

// The parentheses keep the end marker inside the expression; the UI demo page
// replaces only the initial JSON between the markers.
// prettier-ignore
export const initialConfig: InputConfig = (/* @example-config */ {
  "size": "md",
  "type": "text",
  "label": "Project name",
  "description": "Give your next idea a name.",
  "placeholder": "e.g. My design system",
  "value": "",
  "disabled": false,
  "readOnly": false,
  "required": false,
  "invalid": false
} /* @end-example-config */);

/**
 * Without a config it keeps its own state; the UI demo page passes one config
 * that the panel and the preview share.
 */
export function InputPlayground({
  config,
  onConfigChange,
}: {
  config?: InputConfig;
  onConfigChange?: (config: SetStateAction<InputConfig>) => void;
} = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {state.label}
        {state.required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <Input
        id={id}
        size={state.size}
        type={state.type}
        value={state.value}
        placeholder={state.placeholder}
        disabled={state.disabled}
        readOnly={state.readOnly}
        required={state.required}
        aria-invalid={state.invalid}
        aria-describedby={`${id}-description`}
        onValueChange={(value) =>
          change((previous) => ({ ...previous, value }))
        }
      />
      <p
        id={`${id}-description`}
        className={
          state.invalid
            ? "text-xs text-destructive"
            : "text-xs text-muted-foreground"
        }
      >
        {state.description}
      </p>
    </div>
  );
}
