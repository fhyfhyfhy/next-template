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

// 括号将结束标记保留在表达式内；UI demo 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: ProgressConfig = (/* @example-config */ {
  "label": "生成进度",
  "value": 40,
  "indeterminate": false
} /* @end-example-config */);

/** 不传参数时使用初始配置；UI demo 页面传入面板里的配置。 */
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
