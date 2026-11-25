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
  // UI catalog 是给开发者看的，不让搜索引擎收录。
  return { title: t("app.ui.title"), robots: { index: false } };
}

/**
 * Suspense 的 fallback 和正式内容各渲染一个 header。同一个元素传给两处时，它到浏览器后变成对第一处的引用，
 * React 的开发构建会在 `UiCatalog`（features/ui-catalog/components/ui-catalog.tsx）把它放进自己的元素里时报缺少 key。
 */
export default function UiCatalogPage({
  searchParams,
}: PageProps<"/[locale]/ui">) {
  return (
    <Suspense fallback={<Header />}>
      <UiCatalogContent header={<Header />} searchParams={searchParams} />
    </Suspense>
  );
}

/** 品牌和语言切换属于整个应用，和任务页面一样在 app/ 里组合进 UI catalog 的 header。 */
function Header() {
  const t = useTranslations();
  return (
    <UiCatalogHeader
      brand={
        <Link
          href="/"
          className="flex items-center gap-3 rounded-control focus-ring"
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
}

async function UiCatalogContent({
  header,
  searchParams,
}: { header: ReactNode } & Pick<PageProps<"/[locale]/ui">, "searchParams">) {
  const { component } = await loadUiCatalogSearchParams(searchParams);
  const sources = await getCachedExampleSources(component);
  return <UiCatalog header={header} component={component} sources={sources} />;
}
