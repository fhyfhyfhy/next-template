"use client";

import { ALIGNS, SIDES } from "../../constants/positioner";
import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../option-control";
import { Playground } from "../playground";
import { TextControl } from "../text-control";
import { initialConfig, PopoverPlayground } from "./playground";

export const metadata = {
  title: "Popover",
  icon: "IconMessageCircle",
} satisfies ComponentMetadata;

/** Popover 的可调预览与参数控制。 */
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
          <OptionControl
            {...field("align", "Positioner.align")}
            options={ALIGNS}
          />
          <TextControl {...field("triggerLabel")} />
          <TextControl {...field("title")} />
          <TextControl {...field("description")} />
        </>
      }
    >
      <PopoverPlayground config={config} />
    </Playground>
  );
}
