"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";

export const metadata = {
  title: "基本用法",
  description:
    'TanStack Form 持有值，约束写在它的 validators 里；控件上不写 required、type="email" 这类原生约束，否则 Form 会先拦下提交，TanStack Form 运行不到。',
  order: 10,
};

const schema = z.object({
  email: z.string().trim().min(1, "请输入邮箱").pipe(z.email("邮箱格式不正确")),
});

/**
 * Form 在调用 onSubmit 之前先查控件的原生约束，不通过就不提交，显示浏览器语言的提示或者什么都不显示；
 * 所以约束都写在 validators 里，FieldError 显示它的文案。
 */
export function Example() {
  // 服务端渲染的表单在 hydration 之前提交，会变成浏览器原生的 GET 提交、刷新整页，所以先不可用。
  const hydrated = useHydrated();
  const [submitted, setSubmitted] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { email: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => setSubmitted(value.email),
  });
  return (
    <Form
      className="w-full max-w-xs space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <FieldRoot
            name={field.name}
            disabled={!hydrated}
            invalid={!field.state.meta.isValid}
            dirty={field.state.meta.isDirty}
            touched={field.state.meta.isTouched}
          >
            <FieldLabel>邮箱</FieldLabel>
            <Input
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
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
