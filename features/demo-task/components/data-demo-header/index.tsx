"use client";

import { IconStack2 } from "@tabler/icons-react";

import { cn } from "@/lib/cn";
import { Link } from "@/lib/i18n-navigation";
import { usePathname } from "@/lib/i18n-navigation";

import { RunningTasksBadge } from "./running-tasks-badge";

const links = [
  { href: "/demos/tasks", label: "全部任务" },
  { href: "/demos/feed", label: "作品广场" },
  { href: "/demos/search", label: "搜索" },
  { href: "/demos/recent", label: "最近查看" },
  { href: "/demos/lab", label: "故障实验室" },
] as const;

/** Data demo 各页面共用的导航，右侧是轮询中的进行中任务数。 */
export function DataDemoHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-card text-card-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <Link
          href="/demos"
          className="flex items-center gap-2 rounded-control font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-8 items-center justify-center rounded-control bg-primary text-primary-foreground">
            <IconStack2 className="size-5" aria-hidden />
          </span>
          Data demo
        </Link>
        <nav
          aria-label="Data demo 导航"
          className="flex flex-1 flex-wrap gap-1"
        >
          {links.map((link) => {
            const current = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "rounded-control px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <RunningTasksBadge />
      </div>
    </header>
  );
}
