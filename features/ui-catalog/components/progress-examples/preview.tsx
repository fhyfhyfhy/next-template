"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { initialConfig, ProgressPlayground } from "./playground";

export const metadata = {
  title: "Progress",
  icon: "IconProgress",
} satisfies ComponentMetadata;

/** Progress 的可调预览与参数控制。 */
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
          <OptionControl
            {...numberField("value")}
            options={["0", "25", "40", "75", "100"]}
          />
          <ToggleControl {...field("indeterminate")} />
        </>
      }
    >
      <ProgressPlayground config={config} />
    </Playground>
  );
}
