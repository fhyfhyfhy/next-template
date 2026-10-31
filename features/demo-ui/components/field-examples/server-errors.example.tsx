"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const metadata = {
  title: "服务端返回的字段错误",
  description:
    "提交后服务端按字段返回的错误用 setErrorMap 记到对应字段上，显示在字段下，改动后清除。",
  order: 20,
};

const takenNames = ["低多边形狐狸"];

/** 模拟一次服务端写入：名称冲突时返回字段错误。 */
async function save(name: string) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return takenNames.includes(name.trim())
    ? { ok: false as const, message: "名称已被其他任务占用" }
    : { ok: true as const };
}

/** 错误由服务端结果决定，不在浏览器里预判；提交中按钮不可用。 */
export function Example() {
  const [saved, setSaved] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { name: "低多边形狐狸" },
    onSubmit: async ({ value, formApi }) => {
      const result = await save(value.name);
      if (!result.ok) {
        setSaved(null);
        // 记在 onSubmit 下：字段改动后 TanStack Form 会清掉它。
        formApi.setErrorMap({
          onSubmit: { fields: { name: result.message } },
        });
        return;
      }
      setSaved(value.name);
    },
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
      <form.Field name="name">
        {(field) => (
          <FieldRoot
            name={field.name}
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
              {field.state.meta.errors.join("，")}
            </FieldError>
          </FieldRoot>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "保存中…" : "保存"}
          </Button>
        )}
      </form.Subscribe>
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          已保存：{saved}
        </p>
      )}
    </form>
  );
}
