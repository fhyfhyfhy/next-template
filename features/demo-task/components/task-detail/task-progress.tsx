"use client";

import { useTranslations } from "next-intl";

import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";

/**
 * A null `progress` means the task is still queued and its progress is unknown.
 */
export function TaskProgress({ progress }: { progress: number | null }) {
  const t = useTranslations("demo-task.taskProgress");
  return (
    <ProgressRoot value={progress}>
      <ProgressLabel>
        {progress === null ? t("queued") : t("label")}
      </ProgressLabel>
      <ProgressValue />
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
  );
}
