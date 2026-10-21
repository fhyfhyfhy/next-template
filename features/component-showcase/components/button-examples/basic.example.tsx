"use client";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** 最小按钮用法。 */
export function Example() {
  return <Button onClick={() => window.alert("已开始创建")}>开始创建</Button>;
}
