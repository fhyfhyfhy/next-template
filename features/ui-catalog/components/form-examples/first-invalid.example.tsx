"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectLabel,
  SelectPopup,
  SelectPortal,
  SelectPositioner,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHydrated } from "@/hooks/use-hydrated";

export const metadata = {
  title: "聚焦第一个无效字段",
  description:
    '名称已经填好，提交后焦点越过它，落在第一个无效字段“团队”的选择器上，排在后面的邮箱也无效。onSubmit 返回 form.handleSubmit() 的 Promise，Form 等校验结束再聚焦；控件上不写 required、type="email" 这类原生约束，否则 Form 会先拦下提交，TanStack Form 的校验就不会运行。',
  order: 10,
};

const teams = [
  { value: "design", label: "设计组" },
  { value: "engineering", label: "开发组" },
  { value: "product", label: "产品组" },
];

const schema = z.object({
  name: z.string().trim().min(1, "请输入名称"),
  team: z.string().min(1, "请选择团队"),
  email: z.string().trim().min(1, "请输入邮箱").pipe(z.email("邮箱格式不正确")),
});

/** 字段是否无效从 TanStack 的 field.state.meta 传给 FieldRoot，Form 按它找第一个无效字段。 */
export function Example() {
  // 服务端渲染的表单在 hydration 之前提交，会变成浏览器原生的 GET 提交、刷新整页，所以先不可用。
  const hydrated = useHydrated();
  const [submitted, setSubmitted] = useState(false);
  const form = useForm({
    // team 为空字符串时 Select 显示占位文字。
    defaultValues: { name: "低多边形狐狸", team: "", email: "" },
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
      <form.Field name="name">
        {(field) => (
          <FieldRoot
            name={field.name}
            disabled={!hydrated}
            invalid={!field.state.meta.isValid}
            dirty={field.state.meta.isDirty}
            touched={field.state.meta.isTouched}
          >
            <FieldLabel>名称</FieldLabel>
            <Input
              value={field.state.value}
              placeholder="比如：低多边形小鹿"
              onValueChange={(value) => field.handleChange(value)}
              onBlur={field.handleBlur}
            />
            <FieldError match={!field.state.meta.isValid}>
              {field.state.meta.errors[0]?.message}
            </FieldError>
          </FieldRoot>
        )}
      </form.Field>
      <form.Field name="team">
        {(field) => (
          <FieldRoot
            name={field.name}
            disabled={!hydrated}
            invalid={!field.state.meta.isValid}
            dirty={field.state.meta.isDirty}
            touched={field.state.meta.isTouched}
          >
            <SelectRoot
              items={teams}
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value ?? "")}
            >
              <SelectLabel>团队</SelectLabel>
              <SelectTrigger onBlur={field.handleBlur}>
                <SelectValue placeholder="选择团队" />
                <SelectIcon>
                  <IconChevronDown className="size-4" aria-hidden />
                </SelectIcon>
              </SelectTrigger>
              <SelectPortal>
                <SelectPositioner>
                  <SelectPopup>
                    {teams.map((team) => (
                      <SelectItem key={team.value} value={team.value}>
                        <SelectItemText>{team.label}</SelectItemText>
                        <SelectItemIndicator>
                          <IconCheck className="size-4" aria-hidden />
                        </SelectItemIndicator>
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </SelectPositioner>
              </SelectPortal>
            </SelectRoot>
            <FieldError match={!field.state.meta.isValid}>
              {field.state.meta.errors[0]?.message}
            </FieldError>
          </FieldRoot>
        )}
      </form.Field>
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
              value={field.state.value}
              // 不用 type="email"（原生约束），用 inputMode 让触屏键盘显示 @。
              inputMode="email"
              placeholder="you@example.com"
              onValueChange={(value) => field.handleChange(value)}
              onBlur={field.handleBlur}
            />
            <FieldError match={!field.state.meta.isValid}>
              {field.state.meta.errors[0]?.message}
            </FieldError>
          </FieldRoot>
        )}
      </form.Field>
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
