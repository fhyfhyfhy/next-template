"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../option-control";
import { Playground } from "../playground";
import { TextControl } from "../text-control";
import { ToggleControl } from "../toggle-control";
import { initialConfig, TextareaPlayground } from "./playground";

export const metadata = {
  title: "Textarea",
  icon: "IconAlignLeft",
} satisfies ComponentMetadata;

/** Textarea 的可调预览与参数控制。 */
export function Preview({ source }: { source: string }) {
  const { config, field, numberField, playground } = usePlaygroundConfig(
    initialConfig,
    source,
  );
  return (
    <Playground
      {...playground}
      controls={
        <>
          <TextControl {...field("label")} />
          <TextControl {...field("placeholder")} />
          <TextControl {...field("description")} />
          <OptionControl
            {...numberField("rows")}
            options={["2", "3", "5", "8"]}
          />
          <ToggleControl {...field("disabled")} />
          <ToggleControl {...field("readOnly")} />
          <ToggleControl {...field("invalid")} />
        </>
      }
    >
      <TextareaPlayground config={config} />
    </Playground>
  );
}
