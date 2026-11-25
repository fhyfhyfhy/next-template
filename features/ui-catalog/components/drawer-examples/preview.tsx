"use client";

import { usePlaygroundConfig } from "../../hooks/use-playground-config";
import type { ComponentMetadata } from "../../types/examples";
import { OptionControl } from "../option-control";
import { Playground } from "../playground";
import { TextControl } from "../text-control";
import { ToggleControl } from "../toggle-control";
import { DrawerPlayground, initialConfig } from "./playground";

export const metadata = {
  title: "Drawer",
  icon: "IconLayoutSidebarRight",
} satisfies ComponentMetadata;

/** Drawer 的可调预览与参数控制。 */
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
            {...field("swipeDirection")}
            options={["right", "left", "down", "up"]}
          />
          {/* 从上下滑出的面板占满页面宽度，size 对它不起作用。 */}
          {(config.swipeDirection === "right" ||
            config.swipeDirection === "left") && (
            <OptionControl {...field("size")} options={["sm", "md", "lg"]} />
          )}
          <TextControl {...field("title")} />
          <TextControl {...field("description")} />
          <TextControl {...field("triggerLabel")} />
          <TextControl {...field("closeLabel")} />
          <ToggleControl {...field("open")} />
        </>
      }
    >
      <DrawerPlayground config={config} onConfigChange={setConfig} />
    </Playground>
  );
}
