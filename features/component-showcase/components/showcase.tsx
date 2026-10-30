import { catalog, type ComponentId } from "../constants/catalog";
import type { ExampleSources } from "../types/examples";
import { ComponentNavigation } from "./component-navigation";
import { demosByComponent } from "./component-registry.generated";
import { ExampleList } from "./example-list";
import { ShowcaseHeader } from "./showcase-header";

/** 展示已验证的组件与对应源文件。 */
export function Showcase({
  component,
  sources,
}: {
  component: ComponentId;
  sources: ExampleSources;
}) {
  const item = catalog.find((entry) => entry.id === component) ?? catalog[0];
  const Demo = demosByComponent[component];
  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed top-4 left-4 z-50 rounded-control bg-card p-3 text-card-foreground focus:not-sr-only"
      >
        跳至组件内容
      </a>
      <ShowcaseHeader />
      <div className="mx-auto grid max-w-[1600px] md:min-h-[calc(100dvh-5rem)] md:grid-cols-[208px_minmax(0,1fr)] lg:grid-cols-[248px_minmax(0,1fr)]">
        <ComponentNavigation selected={component} />
        <main id="main-content" className="min-w-0 px-5 py-8 sm:px-8 lg:p-12">
          <div className="mb-9">
            <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
              <span>COMPONENT LIBRARY</span>
              <span>/</span>
              <span className="text-primary">{item.title}</span>
            </div>
            <h1 className="mt-5 text-5xl font-medium tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              {item.title}
              <span className="text-primary">.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base/7 text-muted-foreground">
              {item.description}
            </p>
          </div>
          <div className="space-y-10">
            <Demo key={component} source={sources.playground} />
            <ExampleList
              key={`examples-${component}`}
              component={component}
              sources={sources.examples}
            />
          </div>
          <footer className="mt-12 flex justify-end border-t border-border pt-6 text-muted-foreground">
            <span className="font-mono text-[10px] tracking-wide">
              BUILT WITH BASE UI · TAILWIND CSS
            </span>
          </footer>
        </main>
      </div>
    </>
  );
}
