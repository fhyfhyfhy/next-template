"use client";

import { useState } from "react";

import type { ComponentMetadata } from "../../types/examples";
import { formatExampleSource } from "../../utils/example-source";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { initialConfig, InputPlayground } from "./playground";

export const metadata = {
  title: "Input",
  description: "A native input element that automatically works with Field.",
  icon: "IconForms",
} satisfies ComponentMetadata;

/** Input 的可调预览与参数控制。 */
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
          <OptionControl
            label="type"
            value={config.type}
            options={["text", "email", "password", "number"]}
            onChange={(type) => setConfig({ ...config, type })}
          />
          <TextControl
            label="label"
            value={config.label}
            onChange={(label) => setConfig({ ...config, label })}
          />
          <TextControl
            label="placeholder"
            value={config.placeholder}
            onChange={(placeholder) => setConfig({ ...config, placeholder })}
          />
          <TextControl
            label="description"
            value={config.description}
            onChange={(description) => setConfig({ ...config, description })}
          />
          <TextControl
            label="value"
            value={config.value}
            onChange={(value) => setConfig({ ...config, value })}
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
          <ToggleControl
            label="invalid"
            value={config.invalid}
            onChange={(invalid) => setConfig({ ...config, invalid })}
          />
        </>
      }
    >
      <InputPlayground
        key={resetKey}
        config={config}
        onConfigChange={setConfig}
      />
    </Playground>
  );
}
