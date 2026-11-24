"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { type ComponentProps, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";

export const metadata = {
  title: "聚焦第一个无效字段",
  description:
    '名称已经填好，提交后焦点越过它，落在第一个无效字段“邮箱”上。onSubmit 返回 form.handleSubmit() 的 Promise，Form 等校验结束再聚焦；控件上不写 required、type="email" 这类原生约束，否则 Form 会先拦下提交，TanStack Form 的校验就不会运行。',
  order: 10,
};

const schema = z.object({
  name: z.string().trim().min(1, "请输入名称"),
  email: z.string().trim().min(1, "请输入邮箱").pipe(z.email("邮箱格式不正确")),
  team: z.string().trim().min(1, "请输入团队"),
});

const fields: readonly {
  name: keyof z.input<typeof schema>;
  label: string;
  inputMode?: ComponentProps<typeof Input>["inputMode"];
  placeholder: string;
}[] = [
  { name: "name", label: "名称", placeholder: "比如：低多边形小鹿" },
  {
    name: "email",
    label: "邮箱",
    // 不用 type="email"（原生约束），用 inputMode 让触屏键盘显示 @。
    inputMode: "email",
    placeholder: "you@example.com",
  },
  { name: "team", label: "团队", placeholder: "比如：设计组" },
];

/** 字段是否无效从 TanStack 的 field.state.meta 传给 FieldRoot，Form 按它找第一个无效字段。 */
export function Example() {
  // 服务端渲染的表单在 hydration 之前提交，会变成浏览器原生的 GET 提交、刷新整页，所以先不可用。
  const hydrated = useHydrated();
  const [submitted, setSubmitted] = useState(false);
  const form = useForm({
    defaultValues: { name: "低多边形狐狸", email: "", team: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: () => setSubmitted(true),
  });
  return (
    <Form
      className="w-full max-w-xs space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        return form.handleSubmit();
      }}
    >
      {fields.map(({ name, label, inputMode, placeholder }) => (
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
                inputMode={inputMode}
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
      <Button type="submit" disabled={!hydrated}>
        提交
      </Button>
      {/* 状态行一直挂着、只换文字：和文字一起挂载的 role="status" 读屏可能不播报。 */}
      <p role="status" className="text-sm text-muted-foreground">
        {submitted && "已提交"}
      </p>
    </Form>
  );
}
