"use client";

import { type SetStateAction, useId, useState } from "react";

import {
  SwitchRoot,
  type SwitchRootProps,
  SwitchThumb,
} from "@/components/ui/switch";

export interface SwitchConfig {
  size: NonNullable<SwitchRootProps["size"]>;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
}

// The parentheses keep the end marker inside the expression; the UI demo page
// replaces only the initial JSON between the markers.
// prettier-ignore
export const initialConfig: SwitchConfig = (/* @example-config */ {
  "size": "md",
  "label": "Autosave",
  "description": "Saves your changes to the cloud as you make them.",
  "checked": true,
  "disabled": false,
  "readOnly": false,
  "required": false
} /* @end-example-config */);

/**
 * Without a config it keeps its own state; the UI demo page passes one config
 * that the panel and the preview share.
 */
export function SwitchPlayground({
  config,
  onConfigChange,
}: {
  config?: SwitchConfig;
  onConfigChange?: (config: SetStateAction<SwitchConfig>) => void;
} = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-5 rounded-panel border border-border bg-card p-5 text-card-foreground">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {state.label}
        </label>
        <p id={`${id}-hint`} className="mt-1 text-xs/5 text-muted-foreground">
          {state.description}
        </p>
      </div>
      <SwitchRoot
        id={id}
        size={state.size}
        checked={state.checked}
        disabled={state.disabled}
        readOnly={state.readOnly}
        required={state.required}
        aria-describedby={`${id}-hint`}
        onCheckedChange={(checked) =>
          change((previous) => ({ ...previous, checked }))
        }
      >
        <SwitchThumb />
      </SwitchRoot>
    </div>
  );
}
