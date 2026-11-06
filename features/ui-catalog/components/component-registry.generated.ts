// 此文件由 scripts/ui-catalog/index-generator.mjs 自动生成，请勿手动修改。

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

import { Preview as Component0Preview } from "./badge-examples";
import { Preview as Component1Preview } from "./button-examples";
import { Preview as Component2Preview } from "./checkbox-examples";
import { Preview as Component3Preview } from "./dialog-examples";
import { Preview as Component4Preview } from "./field-examples";
import { Preview as Component5Preview } from "./form-examples";
import { Preview as Component6Preview } from "./input-examples";
import { Preview as Component7Preview } from "./progress-examples";
import { Preview as Component8Preview } from "./select-examples";
import { Preview as Component9Preview } from "./skeleton-examples";
import { Preview as Component10Preview } from "./switch-examples";
import { Preview as Component11Preview } from "./toaster-examples";

export const previewsByComponent = {
  badge: Component0Preview,
  button: Component1Preview,
  checkbox: Component2Preview,
  dialog: Component3Preview,
  field: Component4Preview,
  form: Component5Preview,
  input: Component6Preview,
  progress: Component7Preview,
  select: Component8Preview,
  skeleton: Component9Preview,
  switch: Component10Preview,
  toaster: Component11Preview,
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
