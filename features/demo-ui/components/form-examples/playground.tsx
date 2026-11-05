"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Form, type FormProps } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export interface FormConfig {
  validationMode: NonNullable<FormProps["validationMode"]>;
}

// 括号将结束标记保留在表达式内；UI demo 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: FormConfig = (/* @example-config */ {
  "validationMode": "onSubmit"
} /* @end-example-config */);

/** 不传参数时使用默认配置；UI demo 页面传入同一份配置供面板与预览共享。 */
export function FormPlayground({
  config = initialConfig,
}: { config?: FormConfig } = {}) {
  const [submitted, setSubmitted] = useState<string | null>(null);
  return (
    <Form
      validationMode={config.validationMode}
      className="w-full max-w-xs space-y-3"
      onFormSubmit={(values) => setSubmitted(String(values.name))}
    >
      <FieldRoot name="name">
        <FieldLabel>项目名称</FieldLabel>
        <Input required minLength={3} placeholder="至少 3 个字" />
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
