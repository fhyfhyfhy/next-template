"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { DialogPlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Dialog",
  icon: "IconAppWindow",
} satisfies ComponentMetadata;

/** Dialog 的可调预览与参数控制。 */
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
            {...field("modal")}
            options={["true", "false", "trap-focus"]}
          />
          <OptionControl
            {...field("backdrop", "Backdrop appearance")}
            options={["default", "strong", "clear"]}
          />
          <TextControl {...field("title")} />
          <TextControl {...field("description")} />
          <TextControl {...field("triggerLabel")} />
          <TextControl {...field("closeLabel")} />
          <ToggleControl {...field("open")} />
          <ToggleControl {...field("disablePointerDismissal")} />
        </>
      }
    >
      <DialogPlayground config={config} onConfigChange={setConfig} />
    </Playground>
  );
}
