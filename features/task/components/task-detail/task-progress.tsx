"use client";

import { useTranslations } from "next-intl";

import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";

/** `progress` 为 null 表示还在排队、进度未知。 */
export function TaskProgress({ progress }: { progress: number | null }) {
  const t = useTranslations();
  return (
    <ProgressRoot value={progress}>
      <ProgressLabel>
        {progress === null
          ? t("task.taskProgress.queued")
          : t("task.taskProgress.label")}
      </ProgressLabel>
      <ProgressValue />
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
  );
}
