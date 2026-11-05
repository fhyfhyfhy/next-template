import { Suspense } from "react";

import {
  loadUiDemoSearchParams,
  UiDemo,
  UiDemoHeader,
} from "@/features/demo-ui";
import { readExampleSources } from "@/features/demo-ui/server";

export default function UiDemoPage({
  searchParams,
}: PageProps<"/[locale]/demos/ui">) {
  return (
    <Suspense fallback={<UiDemoHeader />}>
      <UiDemoContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UiDemoContent({
  searchParams,
}: Pick<PageProps<"/[locale]/demos/ui">, "searchParams">) {
  const { component } = await loadUiDemoSearchParams(searchParams);
  const sources = await readExampleSources(component);
  return <UiDemo component={component} sources={sources} />;
}
