"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../option-control";
import { Playground } from "../playground";
import { ToggleControl } from "../toggle-control";
import { initialConfig, TabsPlayground } from "./playground";

export const metadata = {
  title: "Tabs",
  icon: "IconLayoutNavbar",
} satisfies ComponentMetadata;

/** Tabs 的可调预览与参数控制。 */
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
            {...field("size", "List.size")}
            options={["sm", "md", "lg"]}
          />
          <OptionControl
            {...field("orientation")}
            options={["horizontal", "vertical"]}
          />
          <OptionControl
            {...field("value")}
            options={["overview", "settings", "logs"]}
          />
          <ToggleControl {...field("disableLastTab")} />
        </>
      }
    >
      <TabsPlayground config={config} onConfigChange={setConfig} />
    </Playground>
  );
}
