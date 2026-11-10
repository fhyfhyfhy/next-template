"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { Playground } from "../playground";
import { SelectControls } from "./controls";
import { initialConfig, SelectPlayground } from "./playground";

export const metadata = {
  title: "Select",
  icon: "IconSelector",
} satisfies ComponentMetadata;

/** Select 的可调预览与参数控制。 */
export function Preview({ source }: { source: string }) {
  const { config, setConfig, field, numberField, playground } =
    usePlaygroundConfig(initialConfig, source);
  return (
    <Playground
      {...playground}
      controls={
        <SelectControls
          config={config}
          field={field}
          numberField={numberField}
          onChange={setConfig}
        />
      }
    >
      <SelectPlayground config={config} onConfigChange={setConfig} />
    </Playground>
  );
}
