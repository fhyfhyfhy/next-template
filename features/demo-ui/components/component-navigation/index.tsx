import { useTranslations } from "next-intl";

import { catalog } from "../../constants/catalog";
import { iconsByComponent } from "../component-registry.generated";
import { ComponentNavigationLink } from "./link";

/** 组件目录。当前组件写入 URL，支持分享、刷新与浏览器历史。 */
export function ComponentNavigation() {
  const t = useTranslations();
  return (
    <aside className="min-w-0 border-b border-border md:border-r md:border-b-0">
      <div className="p-5 md:sticky md:top-0 md:px-6 md:py-10 lg:px-8">
        <p className="mb-5 hidden font-mono text-[10px] tracking-[0.18em] text-muted-foreground md:block">
          {t("demo-ui.navigation.eyebrow")}
        </p>
        <nav
          aria-label={t("demo-ui.navigation.label")}
          className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible"
        >
          {catalog.map((item) => {
            const Icon = iconsByComponent[item.id];
            return (
              <ComponentNavigationLink key={item.id} component={item.id}>
                <Icon className="size-4" aria-hidden />
                <span className="flex-1">{item.title}</span>
              </ComponentNavigationLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
