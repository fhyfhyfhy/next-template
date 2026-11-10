"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { initialConfig, SkeletonPlayground } from "./playground";

export const metadata = {
  title: "Skeleton",
  icon: "IconSquareDashed",
} satisfies ComponentMetadata;

/** Skeleton 的可调预览与参数控制。 */
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
          <OptionControl {...numberField("lines")} options={["1", "2", "3"]} />
          <ToggleControl {...field("avatar")} />
        </>
      }
    >
      <SkeletonPlayground config={config} />
    </Playground>
  );
}
