"use client";

import { IconBold } from "@tabler/icons-react";

import { Toggle } from "@/components/ui/toggle";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** 只有图标的 Toggle 自己持有按下状态，用 aria-label 命名。 */
export function Example() {
  return (
    <Toggle aria-label="加粗">
      <IconBold aria-hidden />
    </Toggle>
  );
}
