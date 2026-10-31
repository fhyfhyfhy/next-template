"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const metadata = {
  title: "配合 TanStack Form",
  description:
    "TanStack Form 管理值和校验，Field 显示状态与错误；提交时校验，之后每次改动重新校验。",
  order: 10,
};

const schema = z.object({
  name: z.string().trim().min(1, "请输入名称"),
  email: z.email("邮箱格式不正确"),
});

const fields = [
  { name: "name", label: "名称", placeholder: "比如：低多边形小鹿" },
  { name: "email", label: "邮箱", placeholder: "you@example.com" },
] as const;

/** 字段状态从 TanStack 的 field.state.meta 传给 FieldRoot。 */
export function Example() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { name: "", email: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => setSubmitted(value.name),
  });
  return (
    <form
      noValidate
      className="w-full max-w-xs space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {fields.map(({ name, label, placeholder }) => (
        <form.Field key={name} name={name}>
          {(field) => (
            <FieldRoot
              name={field.name}
              invalid={!field.state.meta.isValid}
              dirty={field.state.meta.isDirty}
              touched={field.state.meta.isTouched}
            >
              <FieldLabel>{label}</FieldLabel>
              <Input
                value={field.state.value}
                placeholder={placeholder}
                onValueChange={(value) => field.handleChange(value)}
                onBlur={field.handleBlur}
              />
              <FieldError match={!field.state.meta.isValid}>
                {field.state.meta.errors[0]?.message}
              </FieldError>
            </FieldRoot>
          )}
        </form.Field>
      ))}
      <Button type="submit">提交</Button>
      {submitted && (
        <p role="status" className="text-sm text-muted-foreground">
          已提交：{submitted}
        </p>
      )}
    </form>
  );
}
