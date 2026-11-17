"use client";

import { useState } from "react";

import {
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";

export const metadata = {
  title: "受控输入与校验",
  description: "输入一至两个字符，查看关联的错误提示。",
  order: 20,
};

/** 调用方持有值与校验结果；Field 把输入框标为无效，并把说明和错误关联到它。 */
export function Example() {
  // 受控输入框在 hydration 之前输入的字会被 hydration 盖掉，所以先不可用。
  const hydrated = useHydrated();
  const [value, setValue] = useState("");
  const invalid = value.length > 0 && value.length < 3;
  return (
    <FieldRoot
      invalid={invalid}
      disabled={!hydrated}
      className="w-full max-w-xs"
    >
      <FieldLabel>用户名</FieldLabel>
      <Input
        value={value}
        onValueChange={setValue}
        placeholder="输入至少 3 个字符"
      />
      <FieldDescription>用于显示在个人主页。</FieldDescription>
      <FieldError match={invalid}>用户名至少需要 3 个字符。</FieldError>
    </FieldRoot>
  );
}
