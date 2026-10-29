"use client";

import { useState } from "react";

import type { ComponentMetadata } from "../../types/examples";
import { formatExampleSource } from "../../utils/example-source";
import { OptionControl, TextControl } from "../controls";
import { Playground } from "../playground";
import { BadgePlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Badge",
  description: "A small label for a status or category.",
  icon: "IconTag",
} satisfies ComponentMetadata;

/** Badge 的可调预览与参数控制。 */
export function Demo({ source }: { source: string }) {
  const [config, setConfig] = useState(initialConfig);
  return (
    <Playground
      source={formatExampleSource(source, config)}
      onReset={() => setConfig(initialConfig)}
      controls={
        <>
          <OptionControl
            label="variant"
            value={config.variant}
            options={["default", "secondary", "outline", "destructive"]}
            onChange={(variant) => setConfig({ ...config, variant })}
          />
          <TextControl
            label="label"
            value={config.label}
            onChange={(label) => setConfig({ ...config, label })}
          />
        </>
      }
    >
      <BadgePlayground config={config} />
    </Playground>
  );
}
