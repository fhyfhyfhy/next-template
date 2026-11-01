"use client";

import { useState } from "react";

import type { ComponentMetadata } from "../../types/examples";
import { formatExampleSource } from "../../utils/example-source";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { ButtonPlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Button",
  description:
    "A button component that can be rendered as another tag or focusable when disabled.",
  icon: "IconClick",
} satisfies ComponentMetadata;

/** Button's adjustable preview and its controls. */
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
            label="variant"
            value={config.variant}
            options={["primary", "secondary", "outline", "ghost", "danger"]}
            onChange={(variant) => setConfig({ ...config, variant })}
          />
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
          <OptionControl
            label="icon"
            value={config.icon}
            options={["none", "arrow", "plus"]}
            onChange={(icon) => setConfig({ ...config, icon })}
          />
          <ToggleControl
            label="disabled"
            value={config.disabled}
            onChange={(disabled) => setConfig({ ...config, disabled })}
          />
          <ToggleControl
            label="focusableWhenDisabled"
            value={config.focusableWhenDisabled}
            onChange={(focusableWhenDisabled) =>
              setConfig({ ...config, focusableWhenDisabled })
            }
          />
        </>
      }
    >
      <ButtonPlayground key={resetKey} config={config} />
    </Playground>
  );
}
