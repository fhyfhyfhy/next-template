"use client";

import { useTranslations } from "next-intl";

import type { ComponentId } from "../../constants/catalog";
import type { ExampleDefinition, ExampleSources } from "../../types/examples";
import { ExampleCard } from "../example-card";
import { examplesByComponent } from "./registry.generated";

/**
 * Shows the discovered examples, sorted by their own order, then by filename.
 */
export function ExampleList({
  component,
  sources,
}: {
  component: ComponentId;
  sources: ExampleSources["examples"];
}) {
  const t = useTranslations("demo-ui.examples");
  const examples: readonly ExampleDefinition[] = examplesByComponent[component];
  if (examples.length === 0) return null;

  const ordered = [...examples].sort(
    (left, right) =>
      (left.order ?? 0) - (right.order ?? 0) ||
      left.id.localeCompare(right.id, "en"),
  );
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-medium">{t("title")}</h2>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {ordered.map((example) => {
          const Preview = example.component;
          const source = sources[example.id];
          if (source === undefined) {
            // Fast Refresh and the RSC update arrive separately; a new example
            // waits for its source.
            if (process.env.NODE_ENV === "development") return null;
            throw new Error(
              `Missing source for UI demo example: ${component}/${example.id}`,
            );
          }
          return (
            <ExampleCard
              key={example.id}
              title={example.title}
              description={example.description}
              filename={example.filename}
              source={source}
            >
              <Preview />
            </ExampleCard>
          );
        })}
      </div>
    </div>
  );
}
