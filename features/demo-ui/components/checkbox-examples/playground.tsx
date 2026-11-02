"use client";

import { IconCheck, IconMinus } from "@tabler/icons-react";
import { type SetStateAction, useState } from "react";

import {
  CheckboxIndicator,
  CheckboxRoot,
  type CheckboxRootProps,
} from "@/components/ui/checkbox";

export interface CheckboxConfig {
  size: NonNullable<CheckboxRootProps["size"]>;
  label: string;
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
}

// The parentheses keep the end marker inside the expression; the UI demo page
// replaces only the initial JSON between the markers.
// prettier-ignore
export const initialConfig: CheckboxConfig = (/* @example-config */ {
  "size": "md",
  "label": "Get product updates",
  "checked": true,
  "indeterminate": false,
  "disabled": false,
  "readOnly": false,
  "required": false
} /* @end-example-config */);

/**
 * Without a config it keeps its own state; the UI demo page passes one config
 * that the panel and the preview share.
 */
export function CheckboxPlayground({
  config,
  onConfigChange,
}: {
  config?: CheckboxConfig;
  onConfigChange?: (config: SetStateAction<CheckboxConfig>) => void;
} = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  return (
    <label className="flex items-center justify-center gap-3 text-sm">
      <CheckboxRoot
        size={state.size}
        checked={state.checked}
        indeterminate={state.indeterminate}
        disabled={state.disabled}
        readOnly={state.readOnly}
        required={state.required}
        onCheckedChange={(checked) =>
          change((previous) => ({ ...previous, checked, indeterminate: false }))
        }
      >
        <CheckboxIndicator>
          {state.indeterminate ? (
            <IconMinus aria-hidden />
          ) : (
            <IconCheck aria-hidden />
          )}
        </CheckboxIndicator>
      </CheckboxRoot>
      {state.label}
      {state.required && <span className="text-destructive">*</span>}
    </label>
  );
}
