"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { TASK_LIST_HREF } from "../../utils/task-urls";

// `segment` 是这个 layout 下一级的路由 segment，和 href 的第一段相同。
const links = [
  { href: TASK_LIST_HREF, segment: "tasks", key: "tasks" },
  { href: "/feed", segment: "feed", key: "feed" },
  { href: "/search", segment: "search", key: "search" },
  { href: "/recent", segment: "recent", key: "recent" },
] as const;

/**
 * 链接对应的页面是不是当前页：页面本身是 `page`，它下面的页面（比如任务详情）是 `true`。`segments` 是这个 layout 下面的
 * 路由 segment，按路由树判断而不看 URL：proxy 把 /tasks 改写到 /zh/tasks，预渲染时服务端读到的路径和浏览器里的不同。
 */
function currentState(linkSegment: string, segments: string[]) {
  const [segment, ...below] = segments;
  if (segment !== linkSegment) return undefined;
  return below.length === 0 ? "page" : "true";
}

interface TaskHeaderProps {
  /** 左侧的品牌和首页链接，属于整个应用，由 app 的 layout 传入。 */
  brand: ReactNode;
  /** 右侧的进行中任务数。它要读数据：传入时包在自己的 Suspense 里，导航不用等这次读取。 */
  badge: ReactNode;
  /** 最右侧的全局操作，比如切换语言。 */
  actions: ReactNode;
}

/** 任务各页面共用的 header：任务页面之间的导航，两边放 app 传入的品牌和操作。 */
export function TaskHeader({ brand, badge, actions }: TaskHeaderProps) {
  const t = useTranslations();
  const segments = useSelectedLayoutSegments();
  return (
    <header className="border-b border-border bg-card text-card-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        {brand}
        <nav
          aria-label={t("task.nav.label")}
          className="flex flex-1 flex-wrap gap-1"
        >
          {links.map((link) => {
            const current = currentState(link.segment, segments);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current}
                className={cn(
                  "rounded-control px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {t(`task.nav.${link.key}`)}
              </Link>
            );
          })}
        </nav>
        {badge}
        {actions}
      </div>
    </header>
  );
}
