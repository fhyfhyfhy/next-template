import { IconStack2 } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  loadUiCatalogSearchParams,
  UiCatalog,
  UiCatalogHeader,
} from "@/features/ui-catalog";
import { getCachedExampleSources } from "@/features/ui-catalog/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  // 设计系统的目录是给开发者看的，不让搜索引擎收录。
  return { title: t("app.ui.title"), robots: { index: false } };
}

/** 品牌和语言切换属于整个应用，和任务页面一样在 app/ 里组合进目录的 header。 */
export default function UiCatalogPage({
  searchParams,
}: PageProps<"/[locale]/ui">) {
  const t = useTranslations();
  const header = (
    <UiCatalogHeader
      brand={
        <Link
          href="/"
          className="flex items-center gap-3 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-9 items-center justify-center rounded-control bg-primary text-primary-foreground">
            <IconStack2 className="size-6" aria-hidden />
          </span>
          <span className="text-xl font-semibold tracking-tight">
            {t("app.name")}
            <span aria-hidden className="ml-1 text-primary">
              .
            </span>
          </span>
        </Link>
      }
      actions={<LocaleSwitcher />}
    />
  );
  return (
    <Suspense fallback={header}>
      <UiCatalogContent header={header} searchParams={searchParams} />
    </Suspense>
  );
}

async function UiCatalogContent({
  header,
  searchParams,
}: { header: ReactNode } & Pick<PageProps<"/[locale]/ui">, "searchParams">) {
  const { component } = await loadUiCatalogSearchParams(searchParams);
  const sources = await getCachedExampleSources(component);
  return <UiCatalog header={header} component={component} sources={sources} />;
}
