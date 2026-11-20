import { Field as FieldPrimitive } from "@base-ui/react/field";

export { FieldRoot } from "./root";
export type { FieldRootProps } from "./root";
export { FieldLabel } from "./label";
export { FieldDescription } from "./description";
export { FieldError } from "./error";

/** 单行文本用 `@/components/ui/input`，多行用 `@/components/ui/textarea`；其他元素通过 `render` 接入字段。 */
export const FieldControl = FieldPrimitive.Control;
