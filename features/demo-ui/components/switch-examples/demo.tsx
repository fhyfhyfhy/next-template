"use client";

import { useState } from "react";

import type { ComponentMetadata } from "../../types/examples";
import { formatExampleSource } from "../../utils/example-source";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { initialConfig, SwitchPlayground } from "./playground";

export const metadata = {
  title: "Switch",
  description: "A control that indicates whether a setting is on or off.",
  icon: "IconToggleRight",
} satisfies ComponentMetadata;

/** Switch's adjustable preview and its controls. */
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
      controls={
        <>
          <OptionControl
            label="size"
            value={config.size}
            options={["sm", "md", "lg"]}
            onChange={(size) => setConfig({ ...config, size })}
          />
          <TextControl
            label="label"
            value={config.label}
            onChange={(label) => setConfig({ ...config, label })}
          />
          <TextControl
            label="description"
            value={config.description}
            onChange={(description) => setConfig({ ...config, description })}
          />
          <ToggleControl
            label="checked"
            value={config.checked}
            onChange={(checked) => setConfig({ ...config, checked })}
          />
          <ToggleControl
            label="disabled"
            value={config.disabled}
            onChange={(disabled) => setConfig({ ...config, disabled })}
          />
          <ToggleControl
            label="readOnly"
            value={config.readOnly}
            onChange={(readOnly) => setConfig({ ...config, readOnly })}
          />
          <ToggleControl
            label="required"
            value={config.required}
            onChange={(required) => setConfig({ ...config, required })}
          />
        </>
      }
    >
      <SwitchPlayground
        key={resetKey}
        config={config}
        onConfigChange={setConfig}
      />
    </Playground>
  );
}
