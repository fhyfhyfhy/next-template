import { expect, test } from "vitest";

import { labelVariants } from "@/components/ui/field";
import { cn } from "@/lib/cn";

import { CONTROL_LABEL_CLASS } from "./control-label";

test("参数面板的标签 class 覆盖 labelVariants 的每一个 class，几种控件的标签看起来一样", () => {
  expect(cn(labelVariants(), CONTROL_LABEL_CLASS)).toBe(CONTROL_LABEL_CLASS);
});
