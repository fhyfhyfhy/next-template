"use client";

import { type SetStateAction, useState } from "react";

import {
  TabsIndicator,
  TabsList,
  TabsPanel,
  TabsRoot,
  type TabsSize,
  TabsTab,
} from "@/components/ui/tabs";

export interface TabsConfig {
  size: TabsSize;
  orientation: "horizontal" | "vertical";
  value: "overview" | "settings" | "logs";
  disableLastTab: boolean;
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: TabsConfig = (/* @example-config */ {
  "size": "md",
  "orientation": "horizontal",
  "value": "overview",
  "disableLastTab": false
} /* @end-example-config */);

const tabs = [
  { value: "overview", label: "概览", content: "任务的状态、创建时间和封面。" },
  { value: "settings", label: "参数", content: "生成时用的风格和面数。" },
  { value: "logs", label: "日志", content: "生成过程中每一步的输出。" },
] as const;

/** 不传 config 和 onConfigChange 时使用本地状态；UI catalog 页面两个一起传，面板与预览共享同一份配置。 */
export function TabsPlayground({
  config,
  onConfigChange,
}:
  | {
      config: TabsConfig;
      onConfigChange: (config: SetStateAction<TabsConfig>) => void;
    }
  | { config?: undefined; onConfigChange?: undefined } = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  return (
    <TabsRoot
      value={state.value}
      orientation={state.orientation}
      onValueChange={(value: TabsConfig["value"]) =>
        change((previous) => ({ ...previous, value }))
      }
      className="flex gap-4 data-[orientation=horizontal]:flex-col"
    >
      <TabsList size={state.size} aria-label="任务详情">
        {tabs.map((tab, index) => (
          <TabsTab
            key={tab.value}
            value={tab.value}
            disabled={state.disableLastTab && index === tabs.length - 1}
          >
            {tab.label}
          </TabsTab>
        ))}
        <TabsIndicator />
      </TabsList>
      {tabs.map((tab) => (
        <TabsPanel key={tab.value} value={tab.value} className="text-sm">
          {tab.content}
        </TabsPanel>
      ))}
    </TabsRoot>
  );
}
