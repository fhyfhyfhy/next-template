"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../option-control";
import { Playground } from "../playground";
import { TextControl } from "../text-control";
import { initialConfig, TablePlayground } from "./playground";

export const metadata = {
  title: "Table",
  icon: "IconTable",
} satisfies ComponentMetadata;

/** Table 的可调预览与参数控制。 */
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
          <OptionControl {...numberField("rows")} options={["1", "3", "5"]} />
          <TextControl {...field("label", "aria-label")} />
        </>
      }
    >
      <TablePlayground config={config} />
    </Playground>
  );
}
