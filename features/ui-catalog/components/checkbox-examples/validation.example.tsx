"use client";

import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";

import { CheckboxIndicator, CheckboxRoot } from "@/components/ui/checkbox";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";

export const metadata = {
  title: "勾选校验",
  description: "勾选同意条款后清除错误，取消勾选后再次显示。",
  order: 30,
};

/**
 * 调用方维护勾选状态和校验结果；Field 把复选框标为无效，并把错误关联到它。
 * FieldLabel 包住复选框，复选框的名称取自它的文字；它是正文而不是字段标题，所以换回正文的字号和颜色。
 */
export function Example() {
  const [checked, setChecked] = useState(false);
  const invalid = !checked;
  return (
    <FieldRoot invalid={invalid}>
      <FieldLabel className="flex items-center gap-3 text-sm font-normal text-foreground">
        <CheckboxRoot checked={checked} onCheckedChange={setChecked} required>
          <CheckboxIndicator>
            <IconCheck aria-hidden />
          </CheckboxIndicator>
        </CheckboxRoot>
        我已阅读并同意使用条款
      </FieldLabel>
      <FieldError match={invalid}>请先同意使用条款。</FieldError>
    </FieldRoot>
  );
}
