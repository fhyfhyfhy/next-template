"use client";

import { SIDES } from "../../constants/positioner";
import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../option-control";
import { Playground } from "../playground";
import { TextControl } from "../text-control";
import { initialConfig, TooltipPlayground } from "./playground";

export const metadata = {
  title: "Tooltip",
  icon: "IconMessage",
} satisfies ComponentMetadata;

/** Tooltip 的可调预览与参数控制。 */
export function Preview({ source }: { source: string }) {
  const { config, field, playground } = usePlaygroundConfig(
    initialConfig,
    source,
  );
  return (
    <Playground
      {...playground}
      controls={
        <>
          <OptionControl
            {...field("side", "Positioner.side")}
            options={SIDES}
          />
          <TextControl {...field("text")} />
        </>
      }
    >
      <TooltipPlayground config={config} />
    </Playground>
  );
}
