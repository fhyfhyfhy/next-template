"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../option-control";
import { Playground } from "../playground";
import { TextControl } from "../text-control";
import { ToggleControl } from "../toggle-control";
import { initialConfig, TogglePlayground } from "./playground";

export const metadata = {
  title: "Toggle",
  icon: "IconBold",
} satisfies ComponentMetadata;

/** Toggle 的可调预览与参数控制。 */
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
          <OptionControl
            {...field("variant")}
            options={["default", "outline"]}
          />
          <OptionControl {...field("size")} options={["sm", "md", "lg"]} />
          <TextControl {...field("label", "aria-label")} />
          <ToggleControl {...field("pressed")} />
          <ToggleControl {...field("disabled")} />
        </>
      }
    >
      <TogglePlayground config={config} onConfigChange={setConfig} />
    </Playground>
  );
}
