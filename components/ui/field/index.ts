import { Field as FieldPrimitive } from "@base-ui/react/field";

export { FieldRoot } from "./root";
export type { FieldRootProps } from "./root";
export { FieldLabel } from "./label";
export { FieldError } from "./error";

/** 文本输入用 `@/components/ui/input`；其他元素（如 textarea）通过 `render` 接入字段。 */
export const FieldControl = FieldPrimitive.Control;
