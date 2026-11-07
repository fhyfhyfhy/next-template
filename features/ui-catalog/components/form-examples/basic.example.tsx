"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export const metadata = {
  title: "基本用法",
  description:
    "提交时先校验其中的字段：有字段无效就不提交，焦点移到第一个无效的输入框。",
  order: 10,
};

/** onFormSubmit 收到按 FieldRoot 的 name 整理好的值。 */
export function Example() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  return (
    <Form
      className="w-full max-w-xs space-y-3"
      onFormSubmit={(values) => setSubmitted(String(values.email))}
    >
      <FieldRoot name="email">
        <FieldLabel>邮箱</FieldLabel>
        <Input type="email" required placeholder="you@example.com" />
        <FieldError />
      </FieldRoot>
      <Button type="submit">提交</Button>
      {submitted && (
        <p role="status" className="text-sm text-muted-foreground">
          已提交：{submitted}
        </p>
      )}
    </Form>
  );
}
