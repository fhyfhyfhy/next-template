"use client";

import { useState } from "react";

import type { ComponentMetadata } from "../../types/examples";
import { formatExampleSource } from "../../utils/example-source";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { DialogPlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Dialog",
  description: "A popup that opens on top of the entire page.",
  icon: "IconAppWindow",
} satisfies ComponentMetadata;

/** Dialog's adjustable preview and its controls. */
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
            label="modal"
            value={config.modal}
            options={["true", "false", "trap-focus"]}
            onChange={(modal) => setConfig({ ...config, modal })}
          />
          <OptionControl
            label="Backdrop appearance"
            value={config.backdrop}
            options={["default", "strong", "clear"]}
            onChange={(backdrop) => setConfig({ ...config, backdrop })}
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
          <TextControl
            label="triggerLabel"
            value={config.triggerLabel}
            onChange={(triggerLabel) => setConfig({ ...config, triggerLabel })}
          />
          <TextControl
            label="closeLabel"
            value={config.closeLabel}
            onChange={(closeLabel) => setConfig({ ...config, closeLabel })}
          />
          <ToggleControl
            label="open"
            value={config.open}
            onChange={(open) => setConfig({ ...config, open })}
          />
          <ToggleControl
            label="disablePointerDismissal"
            value={config.disablePointerDismissal}
            onChange={(disablePointerDismissal) =>
              setConfig({ ...config, disablePointerDismissal })
            }
          />
        </>
      }
    >
      <DialogPlayground
        key={resetKey}
        config={config}
        onConfigChange={setConfig}
      />
    </Playground>
  );
}
