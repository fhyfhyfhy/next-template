"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSerializer, parseAsStringLiteral, useQueryStates } from "nuqs";

import {
  TabsIndicator,
  TabsList,
  TabsRoot,
  TabsTab,
} from "@/components/ui/tabs";

export const metadata = {
  title: "切换 URL 状态的链接",
  description:
    "每个 tab 渲染成链接，href 指向这个状态的 URL；TabsRoot 的 value 从 URL 读，tab 自己判断是否选中。",
  order: 20,
};

const views = ["grid", "list"] as const;
const viewLabels = { grid: "网格", list: "列表" };

// feature 把 parser 和 serializer 放在自己的 utils/<page>-search-params.ts（.claude/rules/data-flow.md 的 URL state）。
const viewSearchParams = {
  view: parseAsStringLiteral(views).withDefault("grid"),
};
const serializeViewSearchParams = createSerializer(viewSearchParams);

/**
 * href 在当前 URL 上只改 view，中键和 Ctrl/Cmd 点击在新标签页打开同一个状态。onNavigate 里用 setter 写 URL 并拦下
 * 导航，点中的 tab 立即选中，页面不重新加载。
 */
export function Example() {
  const searchParams = useSearchParams();
  const [{ view }, setSearchParams] = useQueryStates(viewSearchParams);
  return (
    <TabsRoot value={view}>
      <TabsList aria-label="视图">
        {views.map((value) => (
          <TabsTab
            key={value}
            value={value}
            nativeButton={false}
            render={
              <Link
                href={serializeViewSearchParams(`?${searchParams.toString()}`, {
                  view: value,
                })}
                onNavigate={(event) => {
                  event.preventDefault();
                  void setSearchParams({ view: value });
                }}
              />
            }
          >
            {viewLabels[value]}
          </TabsTab>
        ))}
        <TabsIndicator />
      </TabsList>
    </TabsRoot>
  );
}
