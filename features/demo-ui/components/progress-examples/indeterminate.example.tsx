"use client";

import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
} from "@/components/ui/progress";

export const metadata = {
  title: "Unknown progress",
  description:
    "Set value to null while the task is queued and has no progress yet.",
  order: 20,
};

/**
 * With value null, screen readers announce "indeterminate progress" and no
 * percentage shows.
 */
export function Example() {
  return (
    <ProgressRoot value={null} className="w-full max-w-sm">
      <ProgressLabel>Queued</ProgressLabel>
      <ProgressTrack>
        <ProgressIndicator className="w-1/3 animate-pulse" />
      </ProgressTrack>
    </ProgressRoot>
  );
}
