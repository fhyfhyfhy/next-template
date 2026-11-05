"use client";

import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import type { ComponentId } from "../../constants/catalog";
import {
  serializeUiDemoSearchParams,
  uiDemoSearchParams,
} from "../../utils/ui-demo-search-params";

/**
 * 目录里的一项。示例由服务端按 URL 渲染（`shallow: false`）；nuqs 在服务端返回前就让新的选择高亮，
 * Back 可以回到上一个组件。
 */
export function ComponentNavigationLink({
  component,
  children,
}: {
  component: ComponentId;
  children: ReactNode;
}) {
  const [{ component: selected }, setSearchParams] = useQueryStates(
    uiDemoSearchParams,
    { shallow: false, history: "push" },
  );
  const current = selected === component;
  return (
    <Link
      href={serializeUiDemoSearchParams("/demos/ui", { component })}
      // 用 onNavigate 而不是 onClick：Ctrl/Cmd 点击在新标签页打开时不触发它，交给浏览器处理。
      onNavigate={(event) => {
        event.preventDefault();
        void setSearchParams({ component });
      }}
      aria-current={current ? "page" : undefined}
      className={cn(
        "group flex shrink-0 items-center gap-3 rounded-control p-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        current
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
      {current && (
        <IconArrowRight className="hidden size-3.5 md:block" aria-hidden />
      )}
    </Link>
  );
}
