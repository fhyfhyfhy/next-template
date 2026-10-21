"use client";

import type { ComponentId } from "../../constants/catalog";
import type { ExampleDefinition, ExampleSources } from "../../types/examples";
import { ExampleCard } from "../example-card";
import { examplesByComponent } from "./registry.generated";

/** 按示例自身的顺序和文件名展示自动发现的场景。 */
export function ExampleList({
  component,
  sources,
}: {
  component: ComponentId;
  sources: ExampleSources["examples"];
}) {
  const examples: readonly ExampleDefinition[] = examplesByComponent[component];
  if (examples.length === 0) return null;

  const ordered = [...examples].sort(
    (left, right) =>
      (left.order ?? 0) - (right.order ?? 0) ||
      left.id.localeCompare(right.id, "en"),
  );
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-medium">使用示例</h2>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {ordered.map((example) => {
          const Preview = example.component;
          const source = sources[example.id];
          if (source === undefined) {
            // Fast Refresh 和 RSC 更新分开到达，新增示例需等待对应源码。
            if (process.env.NODE_ENV === "development") return null;
            throw new Error(
              `Missing source for showcase example: ${component}/${example.id}`,
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
