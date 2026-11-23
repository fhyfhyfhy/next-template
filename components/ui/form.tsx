"use client";

import { Form as FormPrimitive } from "@base-ui/react/form";
import { type SubmitEvent, useState } from "react";

export interface FormProps<
  FormValues extends FormPrimitive.Values = FormPrimitive.Values,
> extends Omit<FormPrimitive.Props<FormValues>, "onSubmit"> {
  /**
   * 字段都有效、Form 放行提交后调用。提交之后才把字段标为无效的调用方，比如 TanStack Form 的校验和写回的服务端
   * 字段错误，要返回这次提交的 Promise（`return form.handleSubmit()`），Form 等它结束再聚焦第一个无效控件。
   */
  onSubmit?: (event: SubmitEvent<HTMLFormElement>) => void | Promise<unknown>;
}

/**
 * 表单元素，渲染 `<form noValidate>`。提交失败时把焦点移到第一个无效控件：
 * - 调用 `onSubmit` 之前先校验其中的 FieldRoot，有字段无效（包括 `invalid` prop）就阻止提交并聚焦，`onSubmit` 不会执行；
 * - `onSubmit` 返回的 Promise 结束时有字段无效，同样聚焦。
 */
export function Form<
  FormValues extends FormPrimitive.Values = FormPrimitive.Values,
>({ errors, onSubmit, ...props }: FormProps<FormValues>) {
  const [settledSubmits, setSettledSubmits] = useState(0);
  // Base UI 在提交之后 `errors` 第一次换成新对象时聚焦第一个无效控件（@base-ui/react/form/Form.js 里依赖 errors 的
  // effect）。每次提交结束给它一份调用方 errors 的新副本，内容不变；其余时候保持同一个对象，否则提交还没结束，
  // 某次重新渲染就先用掉了这次聚焦。
  const [formErrors, setFormErrors] = useState({
    errors,
    settledSubmits,
    copy: errors,
  });
  if (
    formErrors.errors !== errors ||
    formErrors.settledSubmits !== settledSubmits
  ) {
    setFormErrors({ errors, settledSubmits, copy: { ...errors } });
  }
  return (
    <FormPrimitive
      {...props}
      errors={formErrors.copy}
      onSubmit={(event) => {
        // finally 不吞掉 onSubmit 的异常，它照常作为未处理的 rejection 报出来。
        void Promise.resolve(onSubmit?.(event)).finally(() =>
          setSettledSubmits((count) => count + 1),
        );
      }}
    />
  );
}
