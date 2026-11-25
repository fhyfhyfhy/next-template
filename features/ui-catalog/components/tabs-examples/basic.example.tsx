import {
  TabsIndicator,
  TabsList,
  TabsPanel,
  TabsRoot,
  TabsTab,
} from "@/components/ui/tabs";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/**
 * TabsRoot 持有选中的 tab，这里由 defaultValue 交给它自己；每个 TabsTab 和同一 value 的 TabsPanel 对应。
 * TabsIndicator 放在各个 tab 之后，换 tab 时滑过去。方向键在 tab 之间移动，Enter 或空格选中。
 */
export function Example() {
  return (
    <TabsRoot defaultValue="overview" className="flex flex-col gap-4">
      <TabsList aria-label="任务详情">
        <TabsTab value="overview">概览</TabsTab>
        <TabsTab value="settings">参数</TabsTab>
        <TabsTab value="logs">日志</TabsTab>
        <TabsIndicator />
      </TabsList>
      <TabsPanel value="overview" className="text-sm">
        任务的状态、创建时间和封面。
      </TabsPanel>
      <TabsPanel value="settings" className="text-sm">
        生成时用的风格和面数。
      </TabsPanel>
      <TabsPanel value="logs" className="text-sm">
        生成过程中每一步的输出。
      </TabsPanel>
    </TabsRoot>
  );
}
