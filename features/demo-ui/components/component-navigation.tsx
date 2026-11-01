import { IconArrowRight } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import { Link } from "@/lib/i18n/navigation";

import { catalog, type ComponentId } from "../constants/catalog";
import { iconsByComponent } from "./component-registry.generated";

/**
 * The current component goes in the URL, so sharing, reloading and browser
 * history work.
 */
export function ComponentNavigation({ selected }: { selected: ComponentId }) {
  const t = useTranslations("demo-ui.navigation");
  return (
    <aside className="min-w-0 border-b border-border md:border-r md:border-b-0">
      <div className="p-5 md:sticky md:top-0 md:px-6 md:py-10 lg:px-8">
        <p className="mb-5 hidden font-mono text-[10px] tracking-[0.18em] text-muted-foreground md:block">
          {t("eyebrow")}
        </p>
        <nav
          aria-label={t("label")}
          className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible"
        >
          {catalog.map((item) => {
            const Icon = iconsByComponent[item.id];
            return (
              <Link
                key={item.id}
                href={`/demos/ui?component=${item.id}`}
                aria-current={selected === item.id ? "page" : undefined}
                className={cn(
                  "group flex shrink-0 items-center gap-3 rounded-control p-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected === item.id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="flex-1">{item.title}</span>
                {selected === item.id && (
                  <IconArrowRight
                    className="hidden size-3.5 md:block"
                    aria-hidden
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
