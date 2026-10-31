"use client";

import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";

/** `progress` 为 null 表示还在排队、进度未知。 */
export function TaskProgress({ progress }: { progress: number | null }) {
  return (
    <ProgressRoot value={progress}>
      <ProgressLabel>{progress === null ? "排队中" : "生成进度"}</ProgressLabel>
      <ProgressValue />
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
  );
}
