import { Suspense } from "react";

import {
  loadUiCatalogSearchParams,
  UiCatalog,
  UiCatalogHeader,
} from "@/features/ui-catalog";
import { readExampleSources } from "@/features/ui-catalog/server";

export default function UiCatalogPage({
  searchParams,
}: PageProps<"/[locale]/ui">) {
  return (
    <Suspense fallback={<UiCatalogHeader />}>
      <UiCatalogContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UiCatalogContent({
  searchParams,
}: Pick<PageProps<"/[locale]/ui">, "searchParams">) {
  const { component } = await loadUiCatalogSearchParams(searchParams);
  const sources = await readExampleSources(component);
  return <UiCatalog component={component} sources={sources} />;
}
