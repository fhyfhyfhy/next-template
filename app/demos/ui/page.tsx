import { Suspense } from "react";

import { getComponentId, UiDemo, UiDemoHeader } from "@/features/demo-ui";
import { readExampleSources } from "@/features/demo-ui/server";

export default function UiDemoPage({ searchParams }: PageProps<"/demos/ui">) {
  return (
    <Suspense fallback={<UiDemoHeader />}>
      <UiDemoContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UiDemoContent({
  searchParams,
}: Pick<PageProps<"/demos/ui">, "searchParams">) {
  const component = getComponentId((await searchParams).component);
  const sources = await readExampleSources(component);
  return <UiDemo component={component} sources={sources} />;
}
