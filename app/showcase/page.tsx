import { getComponentId, Showcase } from "@/features/component-showcase";
import { readExampleSources } from "@/features/component-showcase/server";

export default async function ShowcasePage({
  searchParams,
}: PageProps<"/showcase">) {
  const component = getComponentId((await searchParams).component);
  const sources = await readExampleSources(component);
  return <Showcase component={component} sources={sources} />;
}
