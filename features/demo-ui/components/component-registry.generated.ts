// 此文件由 scripts/demo-ui/index-generator.mjs 自动生成，请勿手动修改。

import {
  IconAppWindow,
  IconBell,
  IconCheckbox,
  IconClick,
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
import { Demo as Component4Demo } from "./input-examples";
import { Demo as Component5Demo } from "./progress-examples";
import { Demo as Component6Demo } from "./select-examples";
import { Demo as Component7Demo } from "./skeleton-examples";
import { Demo as Component8Demo } from "./switch-examples";
import { Demo as Component9Demo } from "./toaster-examples";

export const demosByComponent = {
  badge: Component0Demo,
  button: Component1Demo,
  checkbox: Component2Demo,
  dialog: Component3Demo,
  input: Component4Demo,
  progress: Component5Demo,
  select: Component6Demo,
  skeleton: Component7Demo,
  switch: Component8Demo,
  toaster: Component9Demo,
};

export const iconsByComponent = {
  badge: IconTag,
  button: IconClick,
  checkbox: IconCheckbox,
  dialog: IconAppWindow,
  input: IconForms,
  progress: IconProgress,
  select: IconSelector,
  skeleton: IconSquareDashed,
  switch: IconToggleRight,
  toaster: IconBell,
};
