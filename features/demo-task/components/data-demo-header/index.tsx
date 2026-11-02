"use client";

import { IconStack2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/cn";
import { Link, usePathname } from "@/lib/i18n/navigation";

import { RunningTasksBadge } from "./running-tasks-badge";

const links = [
  { href: "/demos/tasks", key: "tasks" },
  { href: "/demos/feed", key: "feed" },
  { href: "/demos/search", key: "search" },
  { href: "/demos/recent", key: "recent" },
  { href: "/demos/lab", key: "lab" },
] as const;

/**
 * The navigation shared by the Data demo's pages, with the polled count of
 * active tasks on the right.
 */
export function DataDemoHeader() {
  const t = useTranslations("demo-task.nav");
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
          {t("home")}
        </Link>
        <nav aria-label={t("label")} className="flex flex-1 flex-wrap gap-1">
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
                {t(link.key)}
              </Link>
            );
          })}
        </nav>
        <RunningTasksBadge />
        <LocaleSwitcher />
      </div>
    </header>
  );
}
