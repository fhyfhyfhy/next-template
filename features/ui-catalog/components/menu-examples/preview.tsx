"use client";

import { ALIGNS, SIDES } from "../../constants/positioner";
import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../option-control";
import { Playground } from "../playground";
import { ToggleControl } from "../toggle-control";
import { initialConfig, MenuPlayground } from "./playground";

export const metadata = {
  title: "Menu",
  icon: "IconMenu2",
} satisfies ComponentMetadata;

/** Menu 的可调预览与参数控制。 */
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
          <ToggleControl {...field("closeOnClick", "RadioItem.closeOnClick")} />
        </>
      }
    >
      <MenuPlayground config={config} />
    </Playground>
  );
}
