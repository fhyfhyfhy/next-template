"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl, TextControl } from "../controls";
import { Playground } from "../playground";
import { BadgePlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Badge",
  icon: "IconTag",
} satisfies ComponentMetadata;

/** Badge 的可调预览与参数控制。 */
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
            {...field("variant")}
            options={["primary", "muted", "outline", "danger"]}
          />
          <TextControl {...field("label")} />
        </>
      }
    >
      <BadgePlayground config={config} />
    </Playground>
  );
}
