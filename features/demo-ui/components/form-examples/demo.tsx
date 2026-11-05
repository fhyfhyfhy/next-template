"use client";

import { useState } from "react";

import type { ComponentMetadata } from "../../types/examples";
import { formatExampleSource } from "../../utils/example-source";
import { OptionControl } from "../controls";
import { Playground } from "../playground";
import { FormPlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Form",
  description:
    "A form that validates its fields on submit and focuses the first invalid one.",
  icon: "IconForms",
} satisfies ComponentMetadata;

/** Form 的可调预览与参数控制。 */
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
        <OptionControl
          label="validationMode"
          value={config.validationMode}
          options={["onSubmit", "onBlur", "onChange"]}
          onChange={(validationMode) =>
            setConfig({ ...config, validationMode })
          }
        />
      }
    >
      <FormPlayground key={resetKey} config={config} />
    </Playground>
  );
}
