"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";

export const metadata = {
  title: "基本用法",
  description: "包含完整 import 与必要结构，可直接复制。",
  order: 10,
};

/** label 与输入框显式关联。 */
export function Example() {
  const id = useId();
  return (
    <div className="w-full max-w-xs space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        邮箱
      </label>
      <Input id={id} type="email" placeholder="you@example.com" />
    </div>
  );
}
