"use client";

import { FieldLabel, FieldRoot } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** FieldRoot 把 label 和多行输入框关联起来；不受控，输入的内容由浏览器保存。 */
export function Example() {
  return (
    <FieldRoot className="w-full max-w-sm">
      <FieldLabel>项目简介</FieldLabel>
      <Textarea rows={3} placeholder="一两句话说明这个项目做什么" />
    </FieldRoot>
  );
}
