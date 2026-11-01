"use client";

import { useState } from "react";

import type { ComponentMetadata } from "../../types/examples";
import { formatExampleSource } from "../../utils/example-source";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { initialConfig, ProgressPlayground } from "./playground";

export const metadata = {
  title: "Progress",
  description: "Displays the status of a task that takes a long time.",
  icon: "IconProgress",
} satisfies ComponentMetadata;

/** Progress's adjustable preview and its controls. */
export function Demo({ source }: { source: string }) {
  const [config, setConfig] = useState(initialConfig);
  return (
    <Playground
      source={formatExampleSource(source, config)}
      onReset={() => setConfig(initialConfig)}
      controls={
        <>
          <TextControl
            label="label"
            value={config.label}
            onChange={(label) => setConfig({ ...config, label })}
          />
          <OptionControl
            label="value"
            value={String(config.value)}
            options={["0", "25", "40", "75", "100"]}
            onChange={(value) => setConfig({ ...config, value: Number(value) })}
          />
          <ToggleControl
            label="indeterminate"
            value={config.indeterminate}
            onChange={(indeterminate) =>
              setConfig({ ...config, indeterminate })
            }
          />
        </>
      }
    >
      <ProgressPlayground config={config} />
    </Playground>
  );
}
