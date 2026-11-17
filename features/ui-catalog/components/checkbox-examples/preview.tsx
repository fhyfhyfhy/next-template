"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../option-control";
import { Playground } from "../playground";
import { TextControl } from "../text-control";
import { ToggleControl } from "../toggle-control";
import { CheckboxPlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Checkbox",
  icon: "IconCheckbox",
} satisfies ComponentMetadata;

/** Checkbox 的可调预览与参数控制。 */
export function Preview({ source }: { source: string }) {
  const { config, setConfig, field, playground } = usePlaygroundConfig(
    initialConfig,
    source,
  );
  return (
    <Playground
      {...playground}
      controls={
        <>
          <OptionControl {...field("size")} options={["sm", "md", "lg"]} />
          <TextControl {...field("label")} />
          <ToggleControl {...field("checked")} />
          <ToggleControl {...field("indeterminate")} />
          <ToggleControl {...field("disabled")} />
          <ToggleControl {...field("readOnly")} />
          <ToggleControl {...field("required")} />
        </>
      }
    >
      <CheckboxPlayground config={config} onConfigChange={setConfig} />
    </Playground>
  );
}
