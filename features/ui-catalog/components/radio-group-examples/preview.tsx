"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../option-control";
import { Playground } from "../playground";
import { TextControl } from "../text-control";
import { ToggleControl } from "../toggle-control";
import { initialConfig, RadioGroupPlayground } from "./playground";

export const metadata = {
  title: "Radio Group",
  icon: "IconCircleDot",
} satisfies ComponentMetadata;

/** RadioGroup 的可调预览与参数控制。 */
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
          <OptionControl
            {...field("value")}
            options={["day", "week", "month"]}
          />
          <ToggleControl {...field("disabled")} />
        </>
      }
    >
      <RadioGroupPlayground config={config} onConfigChange={setConfig} />
    </Playground>
  );
}
