"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
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
