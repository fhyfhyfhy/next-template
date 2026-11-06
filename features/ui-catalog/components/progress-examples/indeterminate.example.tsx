"use client";

import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
} from "@/components/ui/progress";

export const metadata = {
  title: "进度未知",
  description: "还在排队、拿不到进度时把 value 设为 null。",
  order: 20,
};

/** value 为 null 时屏幕阅读器读出“进度未知”，不显示百分比。 */
export function Example() {
  return (
    <ProgressRoot value={null} className="w-full max-w-sm">
      <ProgressLabel>排队中</ProgressLabel>
      <ProgressTrack>
        <ProgressIndicator className="w-1/3 animate-pulse" />
      </ProgressTrack>
    </ProgressRoot>
  );
}
