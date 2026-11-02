"use client";

import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";

export const metadata = {
  title: "Basic usage",
  description: "Has every import and the structure it needs; copy it as is.",
  order: 10,
};

/** Root holds the value; the caller composes Label, Value and Track. */
export function Example() {
  return (
    <ProgressRoot value={64} className="w-full max-w-sm">
      <ProgressLabel>Uploading</ProgressLabel>
      <ProgressValue />
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
  );
}
