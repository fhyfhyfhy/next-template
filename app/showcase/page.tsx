import { Suspense } from "react";

import {
  getComponentId,
  Showcase,
  ShowcaseHeader,
} from "@/features/component-showcase";
import { readExampleSources } from "@/features/component-showcase/server";

export default function ShowcasePage({ searchParams }: PageProps<"/showcase">) {
  return (
    <Suspense fallback={<ShowcaseHeader />}>
      <ShowcaseContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ShowcaseContent({
  searchParams,
}: Pick<PageProps<"/showcase">, "searchParams">) {
  const component = getComponentId((await searchParams).component);
  const sources = await readExampleSources(component);
  return <Showcase component={component} sources={sources} />;
}
