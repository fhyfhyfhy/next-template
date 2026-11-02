// 此文件由 scripts/demo-ui/index-generator.mjs 自动生成，请勿手动修改。

"use client";

import type { ExampleDefinition } from "../../types/examples";
import {
  Example as Example0,
  metadata as metadata0,
} from "./server-errors.example";
import {
  Example as Example1,
  metadata as metadata1,
} from "./tanstack-form.example";

export const examples = [
  {
    ...metadata0,
    id: "server-errors",
    filename: "server-errors.example.tsx",
    component: Example0,
  },
  {
    ...metadata1,
    id: "tanstack-form",
    filename: "tanstack-form.example.tsx",
    component: Example1,
  },
] satisfies readonly ExampleDefinition[];
