"use client";

import { IconArrowUpRight, IconX } from "@tabler/icons-react";
import { type SetStateAction, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerPopup,
  type DrawerPopupProps,
  DrawerPortal,
  DrawerRoot,
  DrawerTitle,
  DrawerTrigger,
  DrawerViewport,
} from "@/components/ui/drawer";

export interface DrawerConfig {
  swipeDirection: "right" | "left" | "down" | "up";
  size: NonNullable<DrawerPopupProps["size"]>;
  open: boolean;
  title: string;
  description: string;
  triggerLabel: string;
  closeLabel: string;
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: DrawerConfig = (/* @example-config */ {
  "swipeDirection": "right",
  "size": "md",
  "open": false,
  "title": "在页面旁边处理。",
  "description": "抽屉从一条边滑出，后面的页面仍然看得见。",
  "triggerLabel": "打开抽屉",
  "closeLabel": "完成"
} /* @end-example-config */);

/**
 * Root 的 swipeDirection 决定面板占哪条边；调用方持有开关状态。
 * 不传 config 和 onConfigChange 时使用本地状态；UI catalog 页面两个一起传，面板与预览共享同一份配置。
 */
export function DrawerPlayground({
  config,
  onConfigChange,
}:
  | {
      config: DrawerConfig;
      onConfigChange: (config: SetStateAction<DrawerConfig>) => void;
    }
  | { config?: undefined; onConfigChange?: undefined } = {}) {
  const [local, setLocal] = useState(initialConfig);
  const state = config ?? local;
  const change = onConfigChange ?? setLocal;
  return (
    <div className="flex justify-center">
      <DrawerRoot
        open={state.open}
        onOpenChange={(open) => change((previous) => ({ ...previous, open }))}
        swipeDirection={state.swipeDirection}
      >
        <DrawerTrigger render={<Button variant="secondary" />}>
          {state.triggerLabel}
          <IconArrowUpRight aria-hidden />
        </DrawerTrigger>
        <DrawerPortal>
          <DrawerBackdrop />
          <DrawerViewport>
            <DrawerPopup size={state.size}>
              <div className="flex items-start justify-between gap-4">
                <DrawerTitle>{state.title}</DrawerTitle>
                <DrawerClose
                  aria-label="关闭抽屉"
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="-mt-1 -mr-2"
                    />
                  }
                >
                  <IconX aria-hidden />
                </DrawerClose>
              </div>
              <DrawerContent className="flex flex-1 flex-col">
                <DrawerDescription>{state.description}</DrawerDescription>
                <div className="mt-auto flex justify-end pt-8">
                  <DrawerClose render={<Button />}>
                    {state.closeLabel}
                  </DrawerClose>
                </div>
              </DrawerContent>
            </DrawerPopup>
          </DrawerViewport>
        </DrawerPortal>
      </DrawerRoot>
    </div>
  );
}
