"use client";

import { useTranslations } from "next-intl";

import type { ComponentId } from "../../constants/catalog";
import type { ExampleDefinition, ExampleSources } from "../../types/examples";
import { ExampleCard } from "./example-card";
import { compareExamples } from "./example-order";
import { examplesByComponent } from "./registry.generated";

/** 按 compareExamples 的顺序展示自动发现的示例。 */
export function ExampleList({
  component,
  sources,
}: {
  component: ComponentId;
  sources: ExampleSources["examples"];
}) {
  const t = useTranslations();
  const examples: readonly ExampleDefinition[] = examplesByComponent[component];
  if (examples.length === 0) return null;

  const ordered = [...examples].sort(compareExamples);
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-medium">{t("ui-catalog.examples.title")}</h2>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {ordered.map((example) => {
          const Example = example.component;
          const source = sources[example.id];
          if (source === undefined) {
            // Fast Refresh 和 RSC 更新分开到达，新增示例需等待对应源码。
            if (process.env.NODE_ENV === "development") return null;
            throw new Error(
              `Missing source for UI catalog example: ${component}/${example.id}`,
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
              <Example />
            </ExampleCard>
          );
        })}
      </div>
    </div>
  );
}
