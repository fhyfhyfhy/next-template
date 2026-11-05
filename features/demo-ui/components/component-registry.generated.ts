// 此文件由 scripts/demo-ui/index-generator.mjs 自动生成，请勿手动修改。

import {
  IconAppWindow,
  IconBell,
  IconCheckbox,
  IconClick,
  IconClipboardCheck,
  IconForms,
  IconProgress,
  IconSelector,
  IconSquareDashed,
  IconTag,
  IconToggleRight,
} from "@tabler/icons-react";

import { Demo as Component0Demo } from "./badge-examples";
import { Demo as Component1Demo } from "./button-examples";
import { Demo as Component2Demo } from "./checkbox-examples";
import { Demo as Component3Demo } from "./dialog-examples";
import { Demo as Component4Demo } from "./field-examples";
import { Demo as Component5Demo } from "./form-examples";
import { Demo as Component6Demo } from "./input-examples";
import { Demo as Component7Demo } from "./progress-examples";
import { Demo as Component8Demo } from "./select-examples";
import { Demo as Component9Demo } from "./skeleton-examples";
import { Demo as Component10Demo } from "./switch-examples";
import { Demo as Component11Demo } from "./toaster-examples";

export const demosByComponent = {
  badge: Component0Demo,
  button: Component1Demo,
  checkbox: Component2Demo,
  dialog: Component3Demo,
  field: Component4Demo,
  form: Component5Demo,
  input: Component6Demo,
  progress: Component7Demo,
  select: Component8Demo,
  skeleton: Component9Demo,
  switch: Component10Demo,
  toaster: Component11Demo,
};

export const iconsByComponent = {
  badge: IconTag,
  button: IconClick,
  checkbox: IconCheckbox,
  dialog: IconAppWindow,
  field: IconClipboardCheck,
  form: IconForms,
  input: IconForms,
  progress: IconProgress,
  select: IconSelector,
  skeleton: IconSquareDashed,
  switch: IconToggleRight,
  toaster: IconBell,
};
