"use client";

import { useState } from "react";

import type { ComponentMetadata } from "../../types/examples";
import { formatExampleSource } from "../../utils/example-source";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { initialConfig, ToasterPlayground } from "./playground";

export const metadata = {
  title: "Toaster",
  description:
    "A brief message that appears temporarily and stacks with others.",
  icon: "IconBell",
} satisfies ComponentMetadata;

/** Toaster's adjustable preview and its controls. */
export function Demo({ source }: { source: string }) {
  const [config, setConfig] = useState(initialConfig);
  return (
    <Playground
      source={formatExampleSource(source, config)}
      onReset={() => setConfig(initialConfig)}
      controls={
        <>
          <OptionControl
            label="type"
            value={config.type}
            options={["default", "success", "info", "warning", "error"]}
            onChange={(type) => setConfig({ ...config, type })}
          />
          <TextControl
            label="title"
            value={config.title}
            onChange={(title) => setConfig({ ...config, title })}
          />
          <TextControl
            label="description"
            value={config.description}
            onChange={(description) => setConfig({ ...config, description })}
          />
          <ToggleControl
            label="closeButton"
            value={config.closeButton}
            onChange={(closeButton) => setConfig({ ...config, closeButton })}
          />
        </>
      }
    >
      <ToasterPlayground config={config} />
    </Playground>
  );
}
