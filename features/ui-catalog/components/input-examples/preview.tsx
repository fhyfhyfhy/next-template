"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { initialConfig, InputPlayground } from "./playground";

export const metadata = {
  title: "Input",
  icon: "IconForms",
} satisfies ComponentMetadata;

/** Input 的可调预览与参数控制。 */
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
          <OptionControl
            {...field("type")}
            options={["text", "email", "password", "number"]}
          />
          <TextControl {...field("label")} />
          <TextControl {...field("placeholder")} />
          <TextControl {...field("description")} />
          <TextControl {...field("value")} />
          <ToggleControl {...field("disabled")} />
          <ToggleControl {...field("readOnly")} />
          <ToggleControl {...field("required")} />
          <ToggleControl {...field("invalid")} />
        </>
      }
    >
      <InputPlayground config={config} onConfigChange={setConfig} />
    </Playground>
  );
}
