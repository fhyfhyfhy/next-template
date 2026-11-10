"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { initialConfig, ToasterPlayground } from "./playground";

export const metadata = {
  title: "Toaster",
  icon: "IconBell",
} satisfies ComponentMetadata;

/** Toaster 的可调预览与参数控制。 */
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
            {...field("type")}
            options={["default", "success", "info", "warning", "error"]}
          />
          <TextControl {...field("title")} />
          <TextControl {...field("description")} />
          <ToggleControl {...field("closeButton")} />
        </>
      }
    >
      <ToasterPlayground config={config} />
    </Playground>
  );
}
