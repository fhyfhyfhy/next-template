"use client";

import { FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** FieldRoot 把 label 和输入框关联起来，两边都不用写 id。 */
export function Example() {
  return (
    <FieldRoot className="w-full max-w-xs">
      <FieldLabel>邮箱</FieldLabel>
      <Input type="email" placeholder="you@example.com" />
    </FieldRoot>
  );
}
