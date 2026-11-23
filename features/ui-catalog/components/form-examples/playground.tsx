"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";

export interface FormConfig {
  /** 第一次提交之前在什么时候校验；提交之后每次改动都重新校验。 */
  mode: "submit" | "blur" | "change";
}

// 括号将结束标记保留在表达式内；UI catalog 页面只替换标记之间的 JSON 初始值。
// prettier-ignore
export const initialConfig: FormConfig = (/* @example-config */ {
  "mode": "submit"
} /* @end-example-config */);

const schema = z.object({
  name: z.string().trim().min(1, "请输入项目名称").min(3, "至少 3 个字符"),
});

/** 不传参数时使用默认配置；UI catalog 页面传入同一份配置供面板与预览共享。 */
export function FormPlayground({
  config = initialConfig,
}: { config?: FormConfig } = {}) {
  // 服务端渲染的表单在 hydration 之前提交，会变成浏览器原生的 GET 提交、刷新整页，所以先不可用。
  const hydrated = useHydrated();
  const [submitted, setSubmitted] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { name: "" },
    validationLogic: revalidateLogic({ mode: config.mode }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => setSubmitted(value.name),
  });
  return (
    <Form
      className="w-full max-w-xs space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        return form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <FieldRoot
            name={field.name}
            disabled={!hydrated}
            invalid={!field.state.meta.isValid}
            dirty={field.state.meta.isDirty}
            touched={field.state.meta.isTouched}
          >
            <FieldLabel>项目名称</FieldLabel>
            <Input
              placeholder="至少 3 个字符"
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value)}
              onBlur={field.handleBlur}
            />
            <FieldError match={!field.state.meta.isValid}>
              {field.state.meta.errors[0]?.message}
            </FieldError>
          </FieldRoot>
        )}
      </form.Field>
      <Button type="submit" disabled={!hydrated}>
        提交
      </Button>
      {submitted && (
        <p role="status" className="text-sm text-muted-foreground">
          已提交：{submitted}
        </p>
      )}
    </Form>
  );
}
