"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";

export const metadata = {
  title: "受控输入与校验",
  description: "输入一至两个字符，查看关联的错误提示。",
  order: 20,
};

/** 调用方持有值与校验结果。 */
export function Example() {
  const [value, setValue] = useState("");
  const id = useId();
  const invalid = value.length > 0 && value.length < 3;
  return (
    <div className="w-full max-w-xs space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        用户名
      </label>
      <Input
        id={id}
        value={value}
        onValueChange={setValue}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
        placeholder="输入至少 3 个字符"
      />
      <p
        id={`${id}-hint`}
        className={
          invalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"
        }
      >
        {invalid ? "用户名至少需要 3 个字符。" : "用于显示在个人主页。"}
      </p>
    </div>
  );
}
