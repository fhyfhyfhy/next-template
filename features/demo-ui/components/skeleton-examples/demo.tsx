"use client";

import { useState } from "react";

import type { ComponentMetadata } from "../../types/examples";
import { formatExampleSource } from "../../utils/example-source";
import { OptionControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { initialConfig, SkeletonPlayground } from "./playground";

export const metadata = {
  title: "Skeleton",
  description: "A placeholder shown while content is loading.",
  icon: "IconSquareDashed",
} satisfies ComponentMetadata;

/** Skeleton 的可调预览与参数控制。 */
export function Demo({ source }: { source: string }) {
  const [config, setConfig] = useState(initialConfig);
  return (
    <Playground
      source={formatExampleSource(source, config)}
      onReset={() => setConfig(initialConfig)}
      controls={
        <>
          <OptionControl
            label="lines"
            value={String(config.lines)}
            options={["1", "2", "3"]}
            onChange={(lines) => setConfig({ ...config, lines: Number(lines) })}
          />
          <ToggleControl
            label="avatar"
            value={config.avatar}
            onChange={(avatar) => setConfig({ ...config, avatar })}
          />
        </>
      }
    >
      <SkeletonPlayground config={config} />
    </Playground>
  );
}
