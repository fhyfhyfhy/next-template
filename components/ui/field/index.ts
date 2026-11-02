import { Field as FieldPrimitive } from "@base-ui/react/field";

export { FieldRoot } from "./root";
export type { FieldRootProps } from "./root";
export { FieldLabel } from "./label";
export { FieldError } from "./error";

/**
 * Text input uses `@/components/ui/input`; other elements, such as a textarea,
 * join the field through `render`.
 */
export const FieldControl = FieldPrimitive.Control;
