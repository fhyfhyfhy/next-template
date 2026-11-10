"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { FieldPlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Field",
  icon: "IconClipboardCheck",
} satisfies ComponentMetadata;

/** Field 的可调预览与参数控制。 */
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
          <TextControl {...field("label")} />
          <TextControl {...field("placeholder")} />
          <ToggleControl {...field("invalid")} />
          <TextControl {...field("error")} />
        </>
      }
    >
      <FieldPlayground config={config} />
    </Playground>
  );
}
