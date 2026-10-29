// 此文件由 scripts/demo-ui/index-generator.mjs 自动生成，请勿手动修改。

import {
  IconAppWindow,
  IconBell,
  IconCheckbox,
  IconClick,
  IconForms,
  IconSelector,
  IconToggleRight,
} from "@tabler/icons-react";

import { Demo as Component0Demo } from "./button-examples";
import { Demo as Component1Demo } from "./checkbox-examples";
import { Demo as Component2Demo } from "./dialog-examples";
import { Demo as Component3Demo } from "./input-examples";
import { Demo as Component4Demo } from "./select-examples";
import { Demo as Component5Demo } from "./switch-examples";
import { Demo as Component6Demo } from "./toaster-examples";

export const demosByComponent = {
  button: Component0Demo,
  checkbox: Component1Demo,
  dialog: Component2Demo,
  input: Component3Demo,
  select: Component4Demo,
  switch: Component5Demo,
  toaster: Component6Demo,
};

export const iconsByComponent = {
  button: IconClick,
  checkbox: IconCheckbox,
  dialog: IconAppWindow,
  input: IconForms,
  select: IconSelector,
  switch: IconToggleRight,
  toaster: IconBell,
};
