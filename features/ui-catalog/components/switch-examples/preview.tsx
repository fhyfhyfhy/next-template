"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../option-control";
import { Playground } from "../playground";
import { TextControl } from "../text-control";
import { ToggleControl } from "../toggle-control";
import { initialConfig, SwitchPlayground } from "./playground";

export const metadata = {
  title: "Switch",
  icon: "IconToggleRight",
} satisfies ComponentMetadata;

/** Switch 的可调预览与参数控制。 */
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
          <TextControl {...field("description")} />
          <ToggleControl {...field("checked")} />
          <ToggleControl {...field("disabled")} />
          <ToggleControl {...field("readOnly")} />
          <ToggleControl {...field("required")} />
        </>
      }
    >
      <SwitchPlayground config={config} onConfigChange={setConfig} />
    </Playground>
  );
}
