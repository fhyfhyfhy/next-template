"use client";

import { Form as FormPrimitive } from "@base-ui/react/form";

/**
 * 表单元素，渲染 `<form noValidate>`。提交时先校验其中的 FieldRoot：有字段无效（包括 `invalid` prop）
 * 就阻止提交、聚焦第一个无效控件，调用方的 `onSubmit` 不会执行。
 */
export const Form = FormPrimitive;
export type FormProps = FormPrimitive.Props;
