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
  // 服务端渲染的表单在 hydration 之前提交，会变成浏览器原生的 GET 提交、刷新整页，所以先不可用。
  const hydrated = useHydrated();
  const [submitted, setSubmitted] = useState(false);
  const form = useForm({
    defaultValues: { name: "", email: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: () => setSubmitted(true),
  });
  return (
    <Form
      className="w-full max-w-xs space-y-3"
      // 在 Base UI 校验之前清空状态行：字段已经无效、提交被拦下时，上一次的“已提交”不留在错误旁边；
      // 成功后文字从无到有，每次成功读屏都会播报。
      onSubmitCapture={() => setSubmitted(false)}
      onSubmit={(event) => {
        event.preventDefault();
        return form.handleSubmit();
      }}
    >
      {fields.map(({ name, label, placeholder }) => (
        <form.Field key={name} name={name}>
          {(field) => (
            <FieldRoot
              name={field.name}
              disabled={!hydrated}
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
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!hydrated}>
          提交
        </Button>
        {/* 状态行一直挂着、只换文字：和文字一起挂载的 role="status" 读屏可能不播报。 */}
        <p role="status" className="text-sm text-muted-foreground">
          {submitted && "已提交"}
        </p>
      </div>
    </Form>
  );
}
