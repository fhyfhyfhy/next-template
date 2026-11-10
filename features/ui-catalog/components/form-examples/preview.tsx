"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../controls";
import { Playground } from "../playground";
import { FormPlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Form",
  icon: "IconForms",
} satisfies ComponentMetadata;

/** Form 的可调预览与参数控制。 */
export function Preview({ source }: { source: string }) {
  const { config, field, playground } = usePlaygroundConfig(
    initialConfig,
    source,
  );
  return (
    <Playground
      {...playground}
      controls={
        <OptionControl
          {...field("validationMode")}
          options={["onSubmit", "onBlur", "onChange"]}
        />
      }
    >
      <FormPlayground config={config} />
    </Playground>
  );
}
