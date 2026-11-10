"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import { Playground } from "../playground";
import { ButtonPlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Button",
  icon: "IconClick",
} satisfies ComponentMetadata;

/** Button 的可调预览与参数控制。 */
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
            options={["primary", "secondary", "outline", "ghost", "danger"]}
          />
          <OptionControl {...field("size")} options={["sm", "md", "lg"]} />
          <TextControl {...field("label")} />
          <OptionControl
            {...field("icon")}
            options={["none", "arrow", "plus"]}
          />
          <ToggleControl {...field("disabled")} />
          <ToggleControl {...field("focusableWhenDisabled")} />
        </>
      }
    >
      <ButtonPlayground config={config} />
    </Playground>
  );
}
