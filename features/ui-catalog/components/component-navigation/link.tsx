"use client";

import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ComponentId } from "../../constants/catalog";
import { serializeUiCatalogSearchParams } from "../../utils/ui-catalog-search-params";
import { useUiCatalogSearchParams } from "../ui-catalog-navigation";

/** 目录里的一项。服务端返回新组件的示例之前，新的选择就已经高亮。 */
export function ComponentNavigationLink({
  component,
  children,
}: {
  component: ComponentId;
  children: ReactNode;
}) {
  const [{ component: selected }, setSearchParams] = useUiCatalogSearchParams();
  const current = selected === component;
  return (
    <Link
      href={serializeUiCatalogSearchParams("/ui", { component })}
      // 用 onNavigate 而不是 onClick：Ctrl/Cmd 点击在新标签页打开时不触发它，交给浏览器处理。
      onNavigate={(event) => {
        event.preventDefault();
        void setSearchParams({ component });
      }}
      aria-current={current ? "page" : undefined}
      className="group flex shrink-0 items-center gap-3 rounded-control p-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-primary/10 aria-[current=page]:font-medium aria-[current=page]:text-primary"
    >
      {children}
      {current && (
        <IconArrowRight className="hidden size-3.5 md:block" aria-hidden />
      )}
    </Link>
  );
}
