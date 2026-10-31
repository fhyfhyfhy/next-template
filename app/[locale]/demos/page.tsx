import { IconArrowRight } from "@tabler/icons-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Link } from "@/lib/i18n-navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.demos");
  return { title: t("metadataTitle") };
}

const sections = [
  { key: "ui", href: "/demos/ui" },
  { key: "tasks", href: "/demos/tasks" },
  { key: "feed", href: "/demos/feed" },
  { key: "search", href: "/demos/search" },
  { key: "recent", href: "/demos/recent" },
  { key: "lab", href: "/demos/lab" },
] as const;

export default function DemosPage() {
  const t = useTranslations("app.demos");
  return (
    <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:py-20">
      <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
        {t("eyebrow")}
      </p>
      <h1 className="mt-5 text-5xl font-medium tracking-[-0.055em] sm:text-6xl">
        {t("title")}
        <span className="text-primary">.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-base/7 text-muted-foreground">
        {t("intro")}
      </p>
      <ul className="mt-10 grid gap-4">
        {sections.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="group flex items-center justify-between gap-6 rounded-control border border-border bg-card p-6 text-card-foreground transition-colors outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>
                <span className="block text-lg font-medium">
                  {t(`sections.${section.key}.title`)}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {t(`sections.${section.key}.description`)}
                </span>
              </span>
              <IconArrowRight
                className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
