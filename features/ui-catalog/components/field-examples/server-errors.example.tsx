"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, FieldRoot } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";
import { mutationOptions, useMutation } from "@/lib/react-query";
import {
  type ActionResult,
  isActionError,
  unwrapActionResult,
} from "@/lib/request/action-result";

export const metadata = {
  title: "服务端返回的字段错误",
  description:
    "写入经 mutation 发起，服务端拒绝时只返回错误码。名称被占用时界面按错误码选文案，用 setErrorMap 记到字段上：显示在字段下，焦点移到这个字段，改动后清除；其他失败由全局提示弹出 toast。",
  order: 20,
};

const schema = z.object({ name: z.string().trim().min(1, "请输入名称") });

const takenNames = ["低多边形狐狸"];

// 业务错误码；feature 把它放在自己的 constants/error-codes.ts。
const NAME_TAKEN = 40901;

/** 模拟一个 Server Action：名称被占用时返回错误码，message 只给开发者看。 */
async function save(name: string): Promise<ActionResult<void>> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return takenNames.includes(name.trim())
    ? {
        ok: false,
        error: { code: NAME_TAKEN, message: "Name taken", param: "name" },
      }
    : { ok: true, data: undefined };
}

/** feature 把这个 factory 放在自己的 api/：拒绝转成 ActionError，字段上显示的那种之外，失败都由全局提示弹 toast。 */
const saveNameMutationOptions = () =>
  mutationOptions({
    mutationFn: async (name: string) => unwrapActionResult(await save(name)),
    meta: {
      errorMessage: "保存名称失败",
      suppressErrorToast: (error) => isActionError(error, NAME_TAKEN),
    },
  });

/**
 * 浏览器只按 schema 校验格式，名称是否被占用由服务端决定；服务端返回的错误码在界面里换成字段下的文案。
 * 提交中按钮不可用。
 */
export function Example() {
  // 服务端渲染的表单在 hydration 之前提交，会变成浏览器原生的 GET 提交、刷新整页，所以先不可用。
  const hydrated = useHydrated();
  const saveName = useMutation(saveNameMutationOptions());
  const form = useForm({
    defaultValues: { name: "低多边形狐狸" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value, formApi }) => {
      try {
        await saveName.mutateAsync(value.name);
      } catch (error) {
        // 其他失败已由 factory 的 meta 弹 toast。
        if (!isActionError(error, NAME_TAKEN)) return;
        // 记在 onSubmit 下：改动后重新校验通过时，TanStack Form 会清掉它。
        formApi.setErrorMap({
          onSubmit: {
            fields: { name: [{ message: "名称已被其他任务占用" }] },
          },
        });
      }
    },
  });
  return (
    <Form
      className="w-full max-w-xs space-y-3"
      // 在 Base UI 校验之前清空状态行：提交被拦下或服务端拒绝时，上一次的“已保存”不留在错误旁边；
      // 保存成功后文字从无到有，每次成功读屏都会播报。
      onSubmitCapture={() => saveName.reset()}
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
      <div className="flex items-center gap-3">
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
        {/* 状态行一直挂着、只换文字：和文字一起挂载的 role="status" 读屏可能不播报。 */}
        <p role="status" className="text-sm text-muted-foreground">
          {saveName.isSuccess && `已保存：${saveName.variables}`}
        </p>
      </div>
    </Form>
  );
}
