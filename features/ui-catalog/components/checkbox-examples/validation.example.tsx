"use client";

import { IconCheck } from "@tabler/icons-react";
import { useId, useState } from "react";

import { CheckboxIndicator, CheckboxRoot } from "@/components/ui/checkbox";

export const metadata = {
  title: "勾选校验",
  description: "勾选同意条款后清除错误，取消勾选后再次显示。",
  order: 30,
};

/** 调用方维护勾选状态及校验结果。 */
export function Example() {
  const [checked, setChecked] = useState(false);
  const descriptionId = useId();
  const invalid = !checked;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3 text-sm">
        <CheckboxRoot
          checked={checked}
          onCheckedChange={setChecked}
          required
          aria-invalid={invalid}
          aria-describedby={descriptionId}
        >
          <CheckboxIndicator>
            <IconCheck aria-hidden />
          </CheckboxIndicator>
        </CheckboxRoot>
        我已阅读并同意使用条款
      </label>
      <p
        id={descriptionId}
        className={
          invalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"
        }
      >
        {invalid ? "请先同意使用条款。" : "已同意使用条款，可以继续。"}
      </p>
    </div>
  );
}
