"use client";

import { Form as FormPrimitive } from "@base-ui/react/form";
import { type SubmitEvent, useEffect, useState } from "react";

export interface FormProps<
  FormValues extends FormPrimitive.Values = FormPrimitive.Values,
> extends Omit<FormPrimitive.Props<FormValues>, "onSubmit"> {
  /**
   * 字段都有效、Form 放行提交后调用。提交之后才把字段标为无效的调用方，比如 TanStack Form 的校验和写回的服务端
   * 字段错误，要返回这次提交的 Promise（`return form.handleSubmit()`）：Form 等它兑现或拒绝、重新渲染提交之后，
   * 再聚焦第一个无效控件。不返回 Promise 时 Form 不做这一步。
   */
  onSubmit?: (
    event: SubmitEvent<HTMLFormElement>,
  ) => void | PromiseLike<unknown>;
}

/**
 * 表单元素，渲染 `<form noValidate>`。提交失败时把焦点移到第一个无效控件：
 * - Base UI 在调用 `onSubmit` 之前先校验其中的 FieldRoot，有字段无效（包括 `invalid` prop）就阻止提交并聚焦，`onSubmit` 不会执行；
 * - `onSubmit` 返回的 Promise 结束后，Form 自己聚焦表单里第一个无效控件，见 `focusFirstInvalidControl`。
 *
 * 除 `onSubmit` 外的 props 原样交给 Base UI：`errors`、`action`、`onFormSubmit` 的流程，包括 `errors` 变化后的聚焦，
 * 都是 Base UI 自己的。
 */
export function Form<
  FormValues extends FormPrimitive.Values = FormPrimitive.Values,
>({ onSubmit, ...props }: FormProps<FormValues>) {
  // 每次 onSubmit 的 Promise 结束都换一个新对象，effect 才在这次重新渲染提交之后再跑一次。
  const [settledSubmit, setSettledSubmit] = useState<{
    form: HTMLFormElement;
  }>();
  useEffect(() => {
    if (settledSubmit) {
      focusFirstInvalidControl(settledSubmit.form);
    }
  }, [settledSubmit]);
  return (
    <FormPrimitive
      {...props}
      onSubmit={(event) => {
        const result = onSubmit?.(event);
        if (isPromiseLike(result)) {
          const form = event.currentTarget;
          // finally 返回的 Promise 带着原来的拒绝原因，异步失败照常作为未处理的 rejection 报出来。
          // onSubmit 同步抛出的异常不经过这里，直接从提交事件的处理函数抛出，也不会聚焦。
          void Promise.resolve(result).finally(() => {
            setSettledSubmit({ form });
          });
        }
      }}
    />
  );
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

/**
 * 按文档顺序聚焦表单里第一个能获得焦点的 `aria-invalid="true"` 控件：逐个调用 focus()，停在真正拿到焦点的那个，
 * disabled、不显示、不可聚焦的元素 focus() 不生效。input 同时选中文字，和 Base UI 的 focusFirstInvalid
 * （@base-ui/react/form/Form.js）一致。跳过 aria-hidden 的元素：Checkbox、Switch、Select 等给原生表单提交渲染的
 * 隐藏 input 也带 aria-invalid，可见的控件上另有一份。
 */
function focusFirstInvalidControl(form: HTMLFormElement) {
  const controls = form.querySelectorAll<HTMLElement>(
    '[aria-invalid="true"]:not([aria-hidden="true"])',
  );
  for (const control of controls) {
    control.focus();
    if (control.ownerDocument.activeElement === control) {
      if (control instanceof HTMLInputElement) {
        control.select();
      }
      return;
    }
  }
}
