"use client";

import { useState } from "react";

import type { ComponentMetadata } from "../../types/examples";
import { formatExampleSource } from "../../utils/example-source";
import { TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { FieldPlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Field",
  description:
    "Groups a label, control, and error message; TanStack Form supplies the state.",
  icon: "IconClipboardCheck",
} satisfies ComponentMetadata;

/** Field's adjustable preview and its controls. */
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
          <ToggleControl
            label="invalid"
            value={config.invalid}
            onChange={(invalid) => setConfig({ ...config, invalid })}
          />
          <TextControl
            label="error"
            value={config.error}
            onChange={(error) => setConfig({ ...config, error })}
          />
        </>
      }
    >
      <FieldPlayground key={resetKey} config={config} />
    </Playground>
  );
}
