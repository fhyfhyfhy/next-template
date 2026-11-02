"use client";

import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";

export interface ProgressConfig {
  label: string;
  value: number;
  indeterminate: boolean;
}

// The parentheses keep the end marker inside the expression; the UI demo page
// replaces only the initial JSON between the markers.
// prettier-ignore
export const initialConfig: ProgressConfig = (/* @example-config */ {
  "label": "Generation progress",
  "value": 40,
  "indeterminate": false
} /* @end-example-config */);

/**
 * Without a config it uses initialConfig; the UI demo page passes the panel's
 * config.
 */
export function ProgressPlayground({
  config = initialConfig,
}: { config?: ProgressConfig } = {}) {
  return (
    <ProgressRoot
      value={config.indeterminate ? null : config.value}
      className="w-full max-w-sm"
    >
      <ProgressLabel>{config.label}</ProgressLabel>
      <ProgressValue />
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
  );
}
