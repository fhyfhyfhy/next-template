import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  loadUiCatalogSearchParams,
  UiCatalog,
  UiCatalogHeader,
} from "@/features/ui-catalog";
import { readExampleSources } from "@/features/ui-catalog/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  // 设计系统的目录是给开发者看的，不让搜索引擎收录。
  return { title: t("app.ui.title"), robots: { index: false } };
}

export default function UiCatalogPage({
  searchParams,
}: PageProps<"/[locale]/ui">) {
  const t = useTranslations();
  const brand = t("app.metadata.title");
  return (
    <Suspense fallback={<UiCatalogHeader brand={brand} />}>
      <UiCatalogContent brand={brand} searchParams={searchParams} />
    </Suspense>
  );
}

async function UiCatalogContent({
  brand,
  searchParams,
}: { brand: string } & Pick<PageProps<"/[locale]/ui">, "searchParams">) {
  const { component } = await loadUiCatalogSearchParams(searchParams);
  const sources = await readExampleSources(component);
  return <UiCatalog brand={brand} component={component} sources={sources} />;
}
