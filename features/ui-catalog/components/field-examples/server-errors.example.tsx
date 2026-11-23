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
  title: "服务端返回的字段错误",
  description:
    "服务端拒绝时只返回错误码，界面按错误码选文案，用 setErrorMap 记到对应字段上：显示在字段下，焦点移到这个字段，改动后清除。",
  order: 20,
};

const schema = z.object({ name: z.string().trim().min(1, "请输入名称") });

const takenNames = ["低多边形狐狸"];

/** 模拟一次服务端写入：名称冲突时返回错误码，不返回给用户看的文案。 */
async function save(name: string) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return takenNames.includes(name.trim())
    ? { ok: false as const, code: "NAME_TAKEN" as const }
    : { ok: true as const };
}

/**
 * 浏览器只按 schema 校验格式，名称是否被占用由服务端决定；服务端返回的错误码在界面里换成字段下的文案。
 * 提交中按钮不可用。
 */
export function Example() {
  // 服务端渲染的表单在 hydration 之前提交，会变成浏览器原生的 GET 提交、刷新整页，所以先不可用。
  const hydrated = useHydrated();
  const [saved, setSaved] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { name: "低多边形狐狸" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value, formApi }) => {
      const result = await save(value.name);
      if (!result.ok) {
        setSaved(null);
        if (result.code === "NAME_TAKEN") {
          // 记在 onSubmit 下：改动后重新校验通过时，TanStack Form 会清掉它。
          formApi.setErrorMap({
            onSubmit: {
              fields: { name: [{ message: "名称已被其他任务占用" }] },
            },
          });
        }
        return;
      }
      setSaved(value.name);
    },
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
            <FieldLabel>名称</FieldLabel>
            <Input
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
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            type="submit"
            disabled={!hydrated || isSubmitting}
            focusableWhenDisabled={hydrated}
          >
            {isSubmitting ? "保存中…" : "保存"}
          </Button>
        )}
      </form.Subscribe>
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          已保存：{saved}
        </p>
      )}
    </Form>
  );
}
