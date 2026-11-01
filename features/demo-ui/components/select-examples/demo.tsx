"use client";

import { useState } from "react";

import type { ComponentMetadata } from "../../types/examples";
import { formatExampleSource } from "../../utils/example-source";
import { Playground } from "../playground";
import { SelectControls } from "./controls";
import { initialConfig, SelectPlayground } from "./playground";

export const metadata = {
  title: "Select",
  description:
    "A common form component for choosing a predefined value in a dropdown menu.",
  icon: "IconSelector",
} satisfies ComponentMetadata;

/** Select's adjustable preview and its controls. */
export function Demo({ source }: { source: string }) {
  const [config, setConfig] = useState(initialConfig);
  const [resetKey, setResetKey] = useState(0);
  return (
    <Playground
      source={formatExampleSource(source, config)}
      onReset={() => {
        setConfig(initialConfig);
        setResetKey((key) => key + 1);
      }}
      controls={<SelectControls config={config} onChange={setConfig} />}
    >
      <SelectPlayground
        key={resetKey}
        config={config}
        onConfigChange={setConfig}
      />
    </Playground>
  );
}
